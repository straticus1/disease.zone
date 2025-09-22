-- Default ticket types for HIPAA compliant ticketing system

INSERT OR IGNORE INTO ticket_types (name, description, priority_level, auto_assign_role, sla_response_hours, sla_resolution_hours) VALUES
('incident', 'Security incidents and potential breaches requiring immediate attention', 4, 'compliance', 2, 24),
('emergency', 'Critical system failures affecting patient care or data access', 5, 'admin', 1, 4),
('medical', 'Medical professional support requests and clinical data issues', 3, 'medical_professional', 4, 48),
('access', 'User access requests, permission changes, and authentication issues', 2, 'admin', 8, 72),
('legal', 'Legal compliance questions and regulatory requirement clarifications', 3, 'compliance', 12, 120),
('research', 'Research data requests and study-related technical support', 2, 'researcher', 24, 168),
('compliance', 'HIPAA, HITRUST, and other compliance-related questions and assessments', 3, 'compliance', 8, 72),
('security', 'Security policy questions, vulnerability reports, and security assessments', 3, 'compliance', 4, 48),
('systems', 'System administration, performance issues, and infrastructure problems', 2, 'admin', 12, 96),
('cloud', 'AWS infrastructure issues, scaling requests, and cloud security concerns', 2, 'admin', 8, 72);

-- Initial compliance items for HIPAA framework
INSERT OR IGNORE INTO compliance_items (framework, control_id, control_name, description, status, target_completion_date) VALUES
('HIPAA', '164.308(a)(1)', 'Security Officer', 'Designate a security officer responsible for developing and implementing security policies', 'implemented', '2025-01-01'),
('HIPAA', '164.308(a)(3)', 'Workforce Training', 'Implement security awareness and training program for all workforce members', 'implemented', '2025-01-15'),
('HIPAA', '164.308(a)(4)', 'Access Management', 'Implement procedures for granting access to PHI', 'implemented', '2025-01-01'),
('HIPAA', '164.308(a)(5)', 'Access Control', 'Unique user identification and automatic logoff procedures', 'implemented', '2025-01-01'),
('HIPAA', '164.308(a)(6)', 'Incident Response', 'Implement security incident procedures', 'implemented', '2025-01-10'),
('HIPAA', '164.308(a)(7)', 'Contingency Plan', 'Establish data backup and disaster recovery procedures', 'implemented', '2025-01-20'),
('HIPAA', '164.308(a)(8)', 'Risk Assessment', 'Conduct regular security evaluations', 'in_progress', '2025-02-01'),
('HIPAA', '164.310(a)(1)', 'Facility Access', 'Control physical access to facilities and workstations', 'implemented', '2025-01-01'),
('HIPAA', '164.310(b)', 'Workstation Use', 'Restrict access to workstations that access PHI', 'in_progress', '2025-02-15'),
('HIPAA', '164.310(d)(1)', 'Device Controls', 'Control access to hardware and media', 'in_progress', '2025-02-15'),
('HIPAA', '164.312(a)(1)', 'Access Control', 'Unique user identification for each person', 'implemented', '2025-01-01'),
('HIPAA', '164.312(b)', 'Audit Controls', 'Record and examine access to PHI', 'implemented', '2025-01-05'),
('HIPAA', '164.312(c)(1)', 'Integrity', 'Protect PHI from improper alteration', 'implemented', '2025-01-01'),
('HIPAA', '164.312(d)', 'Person Authentication', 'Verify user identity before accessing PHI', 'implemented', '2025-01-01'),
('HIPAA', '164.312(e)(1)', 'Transmission Security', 'Protect PHI during transmission', 'implemented', '2025-01-01');

-- Initial HITRUST CSF compliance items
INSERT OR IGNORE INTO compliance_items (framework, control_id, control_name, description, status, target_completion_date) VALUES
('HITRUST', 'AC-01', 'Access Control Policy', 'Develop formal access control policies and procedures', 'not_started', '2025-03-01'),
('HITRUST', 'AU-01', 'Audit Policy', 'Develop formal audit and accountability policies', 'not_started', '2025-03-01'),
('HITRUST', 'CM-01', 'Configuration Management Policy', 'Establish configuration management policies', 'not_started', '2025-03-15'),
('HITRUST', 'CP-01', 'Contingency Planning Policy', 'Develop contingency planning policies', 'implemented', '2025-01-20'),
('HITRUST', 'IA-01', 'Identity and Authentication Policy', 'Establish identification and authentication policies', 'not_started', '2025-03-01'),
('HITRUST', 'IR-01', 'Incident Response Policy', 'Develop incident response policies and procedures', 'not_started', '2025-02-15'),
('HITRUST', 'PS-01', 'Personnel Security Policy', 'Establish personnel security policies', 'not_started', '2025-04-01'),
('HITRUST', 'RA-01', 'Risk Assessment Policy', 'Develop risk assessment policies and procedures', 'not_started', '2025-03-01'),
('HITRUST', 'SC-01', 'System Protection Policy', 'Establish system and communications protection policies', 'not_started', '2025-03-01'),
('HITRUST', 'SI-01', 'System Integrity Policy', 'Develop system and information integrity policies', 'not_started', '2025-03-01');