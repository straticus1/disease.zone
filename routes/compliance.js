const express = require('express');
const router = express.Router();
const { validateToken } = require('../middleware/auth');

/**
 * Compliance Portal API Routes
 * Provides HIPAA compliant compliance management, ticketing, and change management
 */

// Middleware to check compliance portal access
const checkComplianceAccess = (section) => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const accessCheck = req.app.locals.hipaaService.checkCompliancePortalAccess(user, section);
            if (!accessCheck.granted) {
                return res.status(403).json({ 
                    error: 'Access denied', 
                    reason: accessCheck.reason,
                    allowedSections: accessCheck.allowedSections
                });
            }

            req.complianceAccess = accessCheck;
            next();
        } catch (error) {
            console.error('Compliance access check failed:', error);
            res.status(500).json({ error: 'Access check failed' });
        }
    };
};

// Get user's compliance portal access permissions
router.get('/access', validateToken, (req, res) => {
    try {
        const user = req.user;
        const sections = ['change_management', 'compliance_status', 'documentation', 'tickets', 'user_management', 'audit_logs'];
        const permissions = {};
        
        sections.forEach(section => {
            permissions[section] = req.app.locals.hipaaService.checkCompliancePortalAccess(user, section);
        });

        res.json({
            user: {
                id: user.id,
                role: user.role,
                name: `${user.first_name} ${user.last_name}`
            },
            permissions
        });
    } catch (error) {
        console.error('Error getting compliance access:', error);
        res.status(500).json({ error: 'Failed to get access permissions' });
    }
});

// ============================================================================
// TICKET TYPES MANAGEMENT (Admin only)
// ============================================================================

router.get('/ticket-types', validateToken, checkComplianceAccess('user_management'), async (req, res) => {
    try {
        const ticketTypes = await req.app.locals.databaseService.getAllTicketTypes();
        res.json(ticketTypes);
    } catch (error) {
        console.error('Error fetching ticket types:', error);
        res.status(500).json({ error: 'Failed to fetch ticket types' });
    }
});

router.post('/ticket-types', validateToken, checkComplianceAccess('user_management'), async (req, res) => {
    try {
        const { name, description, priority_level, auto_assign_role, sla_response_hours, sla_resolution_hours } = req.body;
        
        if (!name || !description) {
            return res.status(400).json({ error: 'Name and description are required' });
        }

        const result = await req.app.locals.databaseService.createTicketType({
            name: name.toLowerCase(),
            description,
            priority_level: priority_level || 2,
            auto_assign_role,
            sla_response_hours: sla_response_hours || 24,
            sla_resolution_hours: sla_resolution_hours || 72,
            created_by_user_id: req.user.id
        });

        res.status(201).json({
            id: result.id,
            message: 'Ticket type created successfully'
        });
    } catch (error) {
        console.error('Error creating ticket type:', error);
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            res.status(400).json({ error: 'Ticket type name already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create ticket type' });
        }
    }
});

router.put('/ticket-types/:id', validateToken, checkComplianceAccess('user_management'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, priority_level, auto_assign_role, sla_response_hours, sla_resolution_hours, active } = req.body;
        
        const updates = {};
        if (name !== undefined) updates.name = name.toLowerCase();
        if (description !== undefined) updates.description = description;
        if (priority_level !== undefined) updates.priority_level = priority_level;
        if (auto_assign_role !== undefined) updates.auto_assign_role = auto_assign_role;
        if (sla_response_hours !== undefined) updates.sla_response_hours = sla_response_hours;
        if (sla_resolution_hours !== undefined) updates.sla_resolution_hours = sla_resolution_hours;
        if (active !== undefined) updates.active = active;

        await req.app.locals.databaseService.updateTicketType(id, updates);
        res.json({ message: 'Ticket type updated successfully' });
    } catch (error) {
        console.error('Error updating ticket type:', error);
        res.status(500).json({ error: 'Failed to update ticket type' });
    }
});

// ============================================================================
// TICKETING SYSTEM
// ============================================================================

router.get('/tickets', validateToken, checkComplianceAccess('tickets'), async (req, res) => {
    try {
        const { page = 1, limit = 50, status, type } = req.query;
        const offset = (page - 1) * limit;
        
        let tickets = await req.app.locals.databaseService.getTicketsByUser(
            req.user.id, 
            req.user.role, 
            parseInt(limit), 
            offset
        );

        // Filter by status if provided
        if (status) {
            tickets = tickets.filter(ticket => ticket.status === status);
        }

        // Filter by type if provided
        if (type) {
            tickets = tickets.filter(ticket => ticket.ticket_type_name === type);
        }

        res.json({
            tickets,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: tickets.length
            }
        });
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

router.get('/tickets/:id', validateToken, checkComplianceAccess('tickets'), async (req, res) => {
    try {
        const { id } = req.params;
        const ticket = await req.app.locals.databaseService.getTicketById(id);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Check if user has access to this specific ticket
        if (req.user.role !== 'admin' && req.user.role !== 'compliance' && 
            ticket.created_by_user_id !== req.user.id && ticket.assigned_to_user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied to this ticket' });
        }

        // Get ticket comments
        const comments = await req.app.locals.databaseService.getTicketComments(
            id, 
            req.user.role, 
            req.user.id
        );

        res.json({
            ...ticket,
            comments
        });
    } catch (error) {
        console.error('Error fetching ticket:', error);
        res.status(500).json({ error: 'Failed to fetch ticket' });
    }
});

router.post('/tickets', validateToken, checkComplianceAccess('tickets'), async (req, res) => {
    try {
        const { title, description, ticket_type_id, priority, contains_phi, phi_fields } = req.body;
        
        if (!title || !description || !ticket_type_id) {
            return res.status(400).json({ error: 'Title, description, and ticket type are required' });
        }

        // Validate ticket type exists
        const ticketType = await req.app.locals.databaseService.getTicketTypeById(ticket_type_id);
        if (!ticketType) {
            return res.status(400).json({ error: 'Invalid ticket type' });
        }

        const result = await req.app.locals.databaseService.createTicket({
            title,
            description,
            ticket_type_id,
            created_by_user_id: req.user.id,
            priority: priority || ticketType.priority_level,
            contains_phi: contains_phi || false,
            phi_fields: phi_fields || []
        });

        // Log HIPAA audit for ticket creation
        await req.app.locals.hipaaService.logPHIAccess({
            userId: req.user.id,
            action: 'CREATE',
            resourceType: 'tickets',
            resourceId: result.id,
            phiFields: contains_phi ? phi_fields : [],
            userIp: req.ip,
            userAgent: req.get('User-Agent'),
            success: true,
            reason: 'Ticket created'
        });

        res.status(201).json({
            id: result.id,
            message: 'Ticket created successfully'
        });
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

router.put('/tickets/:id', validateToken, checkComplianceAccess('tickets'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, assigned_to_user_id, priority } = req.body;
        
        // Get current ticket to check permissions
        const currentTicket = await req.app.locals.databaseService.getTicketById(id);
        if (!currentTicket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Check permissions for ticket updates
        const canUpdate = req.user.role === 'admin' || req.user.role === 'compliance' || 
                         currentTicket.created_by_user_id === req.user.id || 
                         currentTicket.assigned_to_user_id === req.user.id;

        if (!canUpdate) {
            return res.status(403).json({ error: 'Not authorized to update this ticket' });
        }

        const updates = {};
        if (status !== undefined) updates.status = status;
        if (assigned_to_user_id !== undefined) updates.assigned_to_user_id = assigned_to_user_id;
        if (priority !== undefined) updates.priority = priority;

        // Set first response time if moving from 'open' status
        if (status && currentTicket.status === 'open' && status !== 'open' && !currentTicket.first_response_at) {
            updates.first_response_at = new Date().toISOString();
        }

        // Set resolved time if status is 'resolved' or 'closed'
        if (status && ['resolved', 'closed'].includes(status) && !currentTicket.resolved_at) {
            updates.resolved_at = new Date().toISOString();
        }

        await req.app.locals.databaseService.updateTicket(id, updates);

        // Create status change comment if status changed
        if (status && status !== currentTicket.status) {
            await req.app.locals.databaseService.createTicketComment({
                ticket_id: id,
                user_id: req.user.id,
                comment_text: `Status changed from ${currentTicket.status} to ${status}`,
                is_internal: false,
                is_status_change: true,
                previous_status: currentTicket.status,
                new_status: status
            });
        }

        res.json({ message: 'Ticket updated successfully' });
    } catch (error) {
        console.error('Error updating ticket:', error);
        res.status(500).json({ error: 'Failed to update ticket' });
    }
});

router.post('/tickets/:id/comments', validateToken, checkComplianceAccess('tickets'), async (req, res) => {
    try {
        const { id } = req.params;
        const { comment_text, is_internal } = req.body;
        
        if (!comment_text) {
            return res.status(400).json({ error: 'Comment text is required' });
        }

        // Get ticket to check permissions
        const ticket = await req.app.locals.databaseService.getTicketById(id);
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const canComment = req.user.role === 'admin' || req.user.role === 'compliance' || 
                          ticket.created_by_user_id === req.user.id || 
                          ticket.assigned_to_user_id === req.user.id;

        if (!canComment) {
            return res.status(403).json({ error: 'Not authorized to comment on this ticket' });
        }

        // Only admin and compliance can make internal comments
        const internal = (req.user.role === 'admin' || req.user.role === 'compliance') ? is_internal : false;

        await req.app.locals.databaseService.createTicketComment({
            ticket_id: id,
            user_id: req.user.id,
            comment_text,
            is_internal: internal || false,
            is_status_change: false
        });

        res.status(201).json({ message: 'Comment added successfully' });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// ============================================================================
// CHANGE MANAGEMENT
// ============================================================================

router.get('/change-requests', validateToken, checkComplianceAccess('change_management'), async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        
        const changeRequests = await req.app.locals.databaseService.getAllChangeRequests(
            parseInt(limit), 
            offset
        );

        res.json({
            changeRequests,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching change requests:', error);
        res.status(500).json({ error: 'Failed to fetch change requests' });
    }
});

router.get('/change-requests/:id', validateToken, checkComplianceAccess('change_management'), async (req, res) => {
    try {
        const { id } = req.params;
        const changeRequest = await req.app.locals.databaseService.getChangeRequestById(id);
        
        if (!changeRequest) {
            return res.status(404).json({ error: 'Change request not found' });
        }

        res.json(changeRequest);
    } catch (error) {
        console.error('Error fetching change request:', error);
        res.status(500).json({ error: 'Failed to fetch change request' });
    }
});

router.post('/change-requests', validateToken, checkComplianceAccess('change_management'), async (req, res) => {
    try {
        const { title, description, change_type, business_justification, risk_level, risk_assessment, impact_assessment, rollback_plan, affects_phi, hipaa_impact_assessment, scheduled_start, scheduled_end } = req.body;
        
        if (!title || !description || !change_type || !business_justification) {
            return res.status(400).json({ error: 'Title, description, change type, and business justification are required' });
        }

        const validChangeTypes = ['security', 'infrastructure', 'application', 'policy', 'emergency'];
        if (!validChangeTypes.includes(change_type)) {
            return res.status(400).json({ error: 'Invalid change type' });
        }

        const result = await req.app.locals.databaseService.createChangeRequest({
            title,
            description,
            change_type,
            requested_by_user_id: req.user.id,
            business_justification,
            risk_level: risk_level || 'medium',
            risk_assessment,
            impact_assessment,
            rollback_plan,
            affects_phi: affects_phi || false,
            hipaa_impact_assessment,
            scheduled_start,
            scheduled_end
        });

        res.status(201).json({
            id: result.id,
            message: 'Change request created successfully'
        });
    } catch (error) {
        console.error('Error creating change request:', error);
        res.status(500).json({ error: 'Failed to create change request' });
    }
});

router.put('/change-requests/:id', validateToken, checkComplianceAccess('change_management'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, approved_by_user_id, approval_notes, implemented_by_user_id, implementation_notes } = req.body;
        
        const updates = {};
        if (status !== undefined) updates.status = status;
        if (approval_notes !== undefined) updates.approval_notes = approval_notes;
        if (implementation_notes !== undefined) updates.implementation_notes = implementation_notes;

        // Handle approval
        if (status === 'approved' && req.user.role === 'admin') {
            updates.approved_by_user_id = req.user.id;
            updates.approved_at = new Date().toISOString();
        }

        // Handle implementation
        if (status === 'implemented') {
            updates.implemented_by_user_id = req.user.id;
            updates.implemented_at = new Date().toISOString();
        }

        await req.app.locals.databaseService.updateChangeRequest(id, updates);
        res.json({ message: 'Change request updated successfully' });
    } catch (error) {
        console.error('Error updating change request:', error);
        res.status(500).json({ error: 'Failed to update change request' });
    }
});

// ============================================================================
// COMPLIANCE TRACKING
// ============================================================================

router.get('/compliance-items', validateToken, checkComplianceAccess('compliance_status'), async (req, res) => {
    try {
        const { framework } = req.query;
        const complianceItems = await req.app.locals.databaseService.getAllComplianceItems(framework);
        res.json(complianceItems);
    } catch (error) {
        console.error('Error fetching compliance items:', error);
        res.status(500).json({ error: 'Failed to fetch compliance items' });
    }
});

router.get('/compliance-stats', validateToken, checkComplianceAccess('compliance_status'), async (req, res) => {
    try {
        const stats = await req.app.locals.databaseService.getComplianceStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching compliance stats:', error);
        res.status(500).json({ error: 'Failed to fetch compliance statistics' });
    }
});

router.put('/compliance-items/:id', validateToken, checkComplianceAccess('compliance_status'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, implementation_notes, evidence_location, assigned_to_user_id } = req.body;
        
        const updates = {};
        if (status !== undefined) updates.status = status;
        if (implementation_notes !== undefined) updates.implementation_notes = implementation_notes;
        if (evidence_location !== undefined) updates.evidence_location = evidence_location;
        if (assigned_to_user_id !== undefined) updates.assigned_to_user_id = assigned_to_user_id;

        // Set completion date if status is implemented or verified
        if (status === 'implemented' || status === 'verified') {
            updates.completed_at = new Date().toISOString();
        }

        // Set verified user if status is verified
        if (status === 'verified') {
            updates.verified_by_user_id = req.user.id;
        }

        // Update review date
        updates.last_reviewed_at = new Date().toISOString();

        await req.app.locals.databaseService.updateComplianceItem(id, updates);
        res.json({ message: 'Compliance item updated successfully' });
    } catch (error) {
        console.error('Error updating compliance item:', error);
        res.status(500).json({ error: 'Failed to update compliance item' });
    }
});

module.exports = router;