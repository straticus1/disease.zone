const crypto = require('crypto');
const WebSocket = require('ws');

/**
 * Messaging Service for Real-time Communication
 * Supports user-to-user messaging, notifications, and system alerts
 */
class MessagingService {
    constructor(databaseService, auditLoggingService) {
        this.db = databaseService;
        this.auditLogger = auditLoggingService;
        this.wss = null; // WebSocket server
        this.connections = new Map(); // userId -> WebSocket connection

        this.MESSAGE_TYPES = {
            DIRECT_MESSAGE: 'direct_message',
            GROUP_MESSAGE: 'group_message',
            SYSTEM_NOTIFICATION: 'system_notification',
            PERMISSION_REQUEST: 'permission_request',
            MEDICAL_ALERT: 'medical_alert'
        };

        this.initializeDatabase();
    }

    /**
     * Initialize database tables for messaging
     */
    async initializeDatabase() {
        try {
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL DEFAULT 'direct',
                    title TEXT,
                    created_by TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1,
                    FOREIGN KEY (created_by) REFERENCES users(id)
                )
            `);

            await this.db.run(`
                CREATE TABLE IF NOT EXISTS conversation_participants (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    left_at DATETIME,
                    role TEXT DEFAULT 'participant',
                    is_active BOOLEAN DEFAULT 1,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE(conversation_id, user_id)
                )
            `);

            await this.db.run(`
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    sender_id TEXT NOT NULL,
                    message_type TEXT DEFAULT 'direct_message',
                    content TEXT NOT NULL,
                    metadata TEXT,
                    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    edited_at DATETIME,
                    is_deleted BOOLEAN DEFAULT 0,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
                    FOREIGN KEY (sender_id) REFERENCES users(id)
                )
            `);

            await this.db.run(`
                CREATE TABLE IF NOT EXISTS message_read_status (
                    id TEXT PRIMARY KEY,
                    message_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (message_id) REFERENCES messages(id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE(message_id, user_id)
                )
            `);

            console.log('✅ Messaging database tables initialized');
        } catch (error) {
            console.error('❌ Error initializing messaging database:', error);
            throw error;
        }
    }

    /**
     * Initialize WebSocket server
     */
    initializeWebSocketServer(server) {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/ws/messaging',
            verifyClient: (info) => {
                // Add authentication verification here
                return true;
            }
        });

        this.wss.on('connection', (ws, req) => {
            console.log('📱 New WebSocket connection established');

            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data);
                    await this.handleWebSocketMessage(ws, message);
                } catch (error) {
                    console.error('WebSocket message error:', error);
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: 'Invalid message format' 
                    }));
                }
            });

            ws.on('close', () => {
                // Remove connection from map
                for (const [userId, connection] of this.connections) {
                    if (connection === ws) {
                        this.connections.delete(userId);
                        console.log(`📱 WebSocket connection closed for user: ${userId}`);
                        break;
                    }
                }
            });
        });

        console.log('🔗 WebSocket messaging server initialized');
    }

    /**
     * Send a message
     */
    async sendMessage(senderId, conversationId, content, messageType = 'direct_message', metadata = {}) {
        try {
            const messageId = crypto.randomUUID();

            // Verify sender is participant in conversation
            const isParticipant = await this.isUserParticipant(senderId, conversationId);
            if (!isParticipant) {
                throw new Error('User is not a participant in this conversation');
            }

            // Insert message
            await this.db.run(`
                INSERT INTO messages (
                    id, conversation_id, sender_id, message_type, content, metadata
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [messageId, conversationId, senderId, messageType, content, JSON.stringify(metadata)]);

            // Log the message
            await this.auditLogger.logOperation(senderId, 'message_sent', {
                conversation_id: conversationId,
                message_id: messageId,
                message_type: messageType
            });

            // Send real-time notification to participants
            await this.notifyConversationParticipants(conversationId, {
                type: 'new_message',
                messageId,
                conversationId,
                senderId,
                content,
                messageType,
                timestamp: new Date().toISOString()
            }, senderId);

            return { success: true, messageId };

        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    /**
     * Create a conversation
     */
    async createConversation(creatorId, participantIds, type = 'direct', title = null) {
        try {
            const conversationId = crypto.randomUUID();

            // Create conversation
            await this.db.run(`
                INSERT INTO conversations (id, type, title, created_by)
                VALUES (?, ?, ?, ?)
            `, [conversationId, type, title, creatorId]);

            // Add participants
            const allParticipants = [...new Set([creatorId, ...participantIds])];
            
            for (const userId of allParticipants) {
                const participantId = crypto.randomUUID();
                await this.db.run(`
                    INSERT INTO conversation_participants (
                        id, conversation_id, user_id, role
                    ) VALUES (?, ?, ?, ?)
                `, [
                    participantId, 
                    conversationId, 
                    userId, 
                    userId === creatorId ? 'admin' : 'participant'
                ]);
            }

            // Log conversation creation
            await this.auditLogger.logOperation(creatorId, 'conversation_created', {
                conversation_id: conversationId,
                type: type,
                participant_count: allParticipants.length
            });

            return { success: true, conversationId };

        } catch (error) {
            console.error('Error creating conversation:', error);
            throw error;
        }
    }

    /**
     * Get user's conversations
     */
    async getUserConversations(userId) {
        try {
            const conversations = await this.db.all(`
                SELECT 
                    c.*,
                    COUNT(cp.user_id) as participant_count,
                    (
                        SELECT content 
                        FROM messages m 
                        WHERE m.conversation_id = c.id 
                        ORDER BY m.sent_at DESC 
                        LIMIT 1
                    ) as last_message,
                    (
                        SELECT sent_at 
                        FROM messages m 
                        WHERE m.conversation_id = c.id 
                        ORDER BY m.sent_at DESC 
                        LIMIT 1
                    ) as last_message_at,
                    (
                        SELECT COUNT(*) 
                        FROM messages m 
                        WHERE m.conversation_id = c.id 
                        AND m.id NOT IN (
                            SELECT mrs.message_id 
                            FROM message_read_status mrs 
                            WHERE mrs.user_id = ?
                        )
                        AND m.sender_id != ?
                    ) as unread_count
                FROM conversations c
                JOIN conversation_participants cp ON c.id = cp.conversation_id
                WHERE cp.user_id = ? AND cp.is_active = 1
                GROUP BY c.id
                ORDER BY last_message_at DESC
            `, [userId, userId, userId]);

            return { success: true, conversations };

        } catch (error) {
            console.error('Error getting user conversations:', error);
            throw error;
        }
    }

    /**
     * Get messages from a conversation
     */
    async getConversationMessages(userId, conversationId, limit = 50, offset = 0) {
        try {
            // Verify user is participant
            const isParticipant = await this.isUserParticipant(userId, conversationId);
            if (!isParticipant) {
                throw new Error('Access denied to conversation');
            }

            const messages = await this.db.all(`
                SELECT 
                    m.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    (
                        SELECT COUNT(*) > 0 
                        FROM message_read_status mrs 
                        WHERE mrs.message_id = m.id AND mrs.user_id = ?
                    ) as is_read
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.conversation_id = ? AND m.is_deleted = 0
                ORDER BY m.sent_at DESC
                LIMIT ? OFFSET ?
            `, [userId, conversationId, limit, offset]);

            // Mark messages as read
            await this.markMessagesAsRead(userId, conversationId);

            return { success: true, messages: messages.reverse() }; // Reverse to show oldest first

        } catch (error) {
            console.error('Error getting conversation messages:', error);
            throw error;
        }
    }

    /**
     * Mark messages as read
     */
    async markMessagesAsRead(userId, conversationId) {
        try {
            // Get unread messages
            const unreadMessages = await this.db.all(`
                SELECT m.id 
                FROM messages m
                WHERE m.conversation_id = ? 
                AND m.sender_id != ?
                AND m.id NOT IN (
                    SELECT mrs.message_id 
                    FROM message_read_status mrs 
                    WHERE mrs.user_id = ?
                )
            `, [conversationId, userId, userId]);

            // Mark as read
            for (const message of unreadMessages) {
                await this.db.run(`
                    INSERT OR IGNORE INTO message_read_status (id, message_id, user_id)
                    VALUES (?, ?, ?)
                `, [crypto.randomUUID(), message.id, userId]);
            }

            return { success: true };

        } catch (error) {
            console.error('Error marking messages as read:', error);
            throw error;
        }
    }

    /**
     * Send system notification
     */
    async sendSystemNotification(recipientId, title, content, metadata = {}) {
        try {
            // Create system conversation if it doesn't exist
            let systemConversation = await this.db.get(`
                SELECT c.id 
                FROM conversations c
                JOIN conversation_participants cp ON c.id = cp.conversation_id
                WHERE c.type = 'system' AND cp.user_id = ?
            `, [recipientId]);

            if (!systemConversation) {
                const result = await this.createConversation(
                    'system', [recipientId], 'system', 'System Notifications'
                );
                systemConversation = { id: result.conversationId };
            }

            // Send notification message
            await this.sendMessage(
                'system',
                systemConversation.id,
                `${title}\n\n${content}`,
                this.MESSAGE_TYPES.SYSTEM_NOTIFICATION,
                metadata
            );

            return { success: true };

        } catch (error) {
            console.error('Error sending system notification:', error);
            throw error;
        }
    }

    // Private helper methods

    /**
     * Check if user is participant in conversation
     */
    async isUserParticipant(userId, conversationId) {
        const participant = await this.db.get(`
            SELECT id FROM conversation_participants
            WHERE user_id = ? AND conversation_id = ? AND is_active = 1
        `, [userId, conversationId]);

        return !!participant;
    }

    /**
     * Notify conversation participants
     */
    async notifyConversationParticipants(conversationId, message, excludeUserId = null) {
        try {
            const participants = await this.db.all(`
                SELECT user_id 
                FROM conversation_participants
                WHERE conversation_id = ? AND is_active = 1
            `, [conversationId]);

            for (const participant of participants) {
                if (participant.user_id !== excludeUserId) {
                    const connection = this.connections.get(participant.user_id);
                    if (connection && connection.readyState === WebSocket.OPEN) {
                        connection.send(JSON.stringify(message));
                    }
                }
            }

        } catch (error) {
            console.error('Error notifying participants:', error);
        }
    }

    /**
     * Handle WebSocket messages
     */
    async handleWebSocketMessage(ws, message) {
        const { type, data, userId } = message;

        // Store connection mapping
        if (userId && type === 'authenticate') {
            this.connections.set(userId, ws);
            ws.send(JSON.stringify({ 
                type: 'authenticated', 
                message: 'Successfully authenticated' 
            }));
            return;
        }

        switch (type) {
            case 'send_message':
                await this.sendMessage(
                    data.senderId,
                    data.conversationId,
                    data.content,
                    data.messageType,
                    data.metadata
                );
                break;

            case 'mark_read':
                await this.markMessagesAsRead(data.userId, data.conversationId);
                break;

            default:
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    message: 'Unknown message type' 
                }));
        }
    }
}

module.exports = MessagingService;