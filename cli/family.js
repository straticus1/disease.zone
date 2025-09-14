const chalk = require('chalk');
const axios = require('axios');
const readline = require('readline');

function getServerUrl() {
    return global.dzConfig.server_url || 'http://localhost:3000';
}

function requireAuth() {
    if (!global.dzConfig.auth_token) {
        console.error(chalk.red('✗ Authentication required'));
        console.log(chalk.gray('Use "diseasezone auth login" to log in'));
        process.exit(1);
    }
}

function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${global.dzConfig.auth_token}`
    };
}

function formatTable(data, columns) {
    if (!data || data.length === 0) {
        console.log(chalk.gray('No family disease records found'));
        return;
    }

    const format = global.dzConfig.output_format || 'table';

    if (format === 'json') {
        console.log(JSON.stringify(data, null, 2));
        return;
    }

    if (format === 'csv') {
        console.log(columns.map(col => col.header).join(','));
        data.forEach(row => {
            console.log(columns.map(col => {
                const value = col.key.split('.').reduce((obj, key) => obj?.[key], row) || '';
                return `"${String(value).replace(/"/g, '""')}"`;
            }).join(','));
        });
        return;
    }

    // Table format (default)
    const colWidths = columns.map(col => {
        const headerWidth = col.header.length;
        const maxDataWidth = Math.max(...data.map(row => {
            const value = col.key.split('.').reduce((obj, key) => obj?.[key], row) || '';
            return String(value).length;
        }));
        return Math.min(Math.max(headerWidth, maxDataWidth), col.maxWidth || 50);
    });

    // Header
    const headerRow = columns.map((col, i) =>
        chalk.cyan.bold(col.header.padEnd(colWidths[i]))
    ).join(' │ ');
    console.log(headerRow);
    console.log(chalk.gray('─'.repeat(headerRow.length - headerRow.replace(/\u001b\[[0-9;]*m/g, '').length + headerRow.replace(/\u001b\[[0-9;]*m/g, '').length)));

    // Data rows
    data.forEach(row => {
        const dataRow = columns.map((col, i) => {
            const value = col.key.split('.').reduce((obj, key) => obj?.[key], row) || '';
            let displayValue = String(value);
            if (displayValue.length > colWidths[i]) {
                displayValue = displayValue.slice(0, colWidths[i] - 3) + '...';
            }
            return displayValue.padEnd(colWidths[i]);
        }).join(' │ ');
        console.log(dataRow);
    });
}

function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1' || value === 'yes';
    }
    return false;
}

function parseArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        return value.split(',').map(item => item.trim()).filter(item => item);
    }
    return [];
}

async function list(options) {
    requireAuth();

    try {
        const params = new URLSearchParams();
        if (options.member) params.append('family_member', options.member);
        if (options.disease) params.append('disease', options.disease);

        const url = `${getServerUrl()}/api/user/family-diseases${params.toString() ? '?' + params.toString() : ''}`;

        const response = await axios.get(url, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            const records = response.data.family_diseases;

            console.log(chalk.cyan.bold(`👨‍👩‍👧‍👦 Family Disease Records (${records.length} records)`));
            console.log(chalk.gray('━'.repeat(60)));

            formatTable(records, [
                { header: 'ID', key: 'id', maxWidth: 5 },
                { header: 'Disease', key: 'disease_name', maxWidth: 25 },
                { header: 'Family Member', key: 'family_member', maxWidth: 15 },
                { header: 'Name', key: 'family_member_name', maxWidth: 20 },
                { header: 'Has Disease', key: 'has_disease', maxWidth: 12 },
                { header: 'Confirmed', key: 'diagnosis_confirmed', maxWidth: 10 }
            ]);

            if (records.length > 0) {
                console.log(chalk.gray('\nUse "diseasezone family info <record-id>" for detailed information'));
            }
        }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error(chalk.red('✗ Authentication token invalid'));
            console.log(chalk.gray('Use "diseasezone auth login" to log in again'));
        } else if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

async function add(options) {
    requireAuth();

    try {
        const recordData = {
            disease_id: parseInt(options.diseaseId),
            family_member: options.member,
            family_member_name: options.name || null,
            has_disease: options.hasDisease !== undefined ? parseBoolean(options.hasDisease) : true,
            diagnosis_confirmed: options.confirmed !== undefined ? parseBoolean(options.confirmed) : false,
            diagnosis_date: options.date || null,
            family_member_has_symptoms: options.symptoms ? parseArray(options.symptoms) : [],
            family_member_had_symptoms: options.pastSymptoms ? parseArray(options.pastSymptoms) : [],
            family_member_has_children: options.hasChildren !== undefined ? parseBoolean(options.hasChildren) : false,
            family_member_children_count: options.childrenCount ? parseInt(options.childrenCount) : 0,
            family_member_children_have_disease: options.childrenAffected !== undefined ? parseBoolean(options.childrenAffected) : false,
            family_member_disease_notes: options.notes || null,
            treatment_history: options.treatments ? parseArray(options.treatments) : []
        };

        // Validate required fields
        if (!recordData.disease_id || isNaN(recordData.disease_id)) {
            console.error(chalk.red('✗ Invalid disease ID'));
            process.exit(1);
        }

        if (!recordData.family_member) {
            console.error(chalk.red('✗ Family member is required'));
            console.log(chalk.gray('Valid family members: mother, father, sibling, child, grandmother, grandfather, aunt, uncle, cousin'));
            process.exit(1);
        }

        const response = await axios.post(`${getServerUrl()}/api/user/family-diseases`, recordData, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            console.log(chalk.green('✓ Family disease record added successfully'));
            console.log(chalk.white('Record ID:'), response.data.family_disease.id);
            console.log(chalk.white('Disease:'), response.data.family_disease.disease_name);
            console.log(chalk.white('Family Member:'), response.data.family_disease.family_member);
        }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error(chalk.red('✗ Authentication token invalid'));
            console.log(chalk.gray('Use "diseasezone auth login" to log in again'));
        } else if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

async function update(recordId, options) {
    requireAuth();

    try {
        const updateData = {};

        if (options.member) updateData.family_member = options.member;
        if (options.name !== undefined) updateData.family_member_name = options.name;
        if (options.hasDisease !== undefined) updateData.has_disease = parseBoolean(options.hasDisease);
        if (options.confirmed !== undefined) updateData.diagnosis_confirmed = parseBoolean(options.confirmed);
        if (options.date !== undefined) updateData.diagnosis_date = options.date;
        if (options.symptoms) updateData.family_member_has_symptoms = parseArray(options.symptoms);
        if (options.pastSymptoms) updateData.family_member_had_symptoms = parseArray(options.pastSymptoms);
        if (options.hasChildren !== undefined) updateData.family_member_has_children = parseBoolean(options.hasChildren);
        if (options.childrenCount) updateData.family_member_children_count = parseInt(options.childrenCount);
        if (options.childrenAffected !== undefined) updateData.family_member_children_have_disease = parseBoolean(options.childrenAffected);
        if (options.notes !== undefined) updateData.family_member_disease_notes = options.notes;
        if (options.treatments) updateData.treatment_history = parseArray(options.treatments);

        if (Object.keys(updateData).length === 0) {
            console.error(chalk.red('✗ No update fields specified'));
            process.exit(1);
        }

        const response = await axios.put(`${getServerUrl()}/api/user/family-diseases/${recordId}`, updateData, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            console.log(chalk.green('✓ Family disease record updated successfully'));

            // Show updated fields
            console.log(chalk.gray('Updated fields:'));
            for (const [key, value] of Object.entries(updateData)) {
                const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
                console.log(chalk.white(`  ${displayKey}:`), displayValue);
            }
        }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error(chalk.red('✗ Authentication token invalid'));
            console.log(chalk.gray('Use "diseasezone auth login" to log in again'));
        } else if (error.response && error.response.status === 404) {
            console.error(chalk.red('✗ Family disease record not found'));
        } else if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

async function deleteRecord(recordId, options) {
    requireAuth();

    try {
        if (!options.yes) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const answer = await new Promise(resolve => {
                rl.question(chalk.yellow('Are you sure you want to delete this family disease record? (y/N): '), resolve);
            });

            rl.close();

            if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
                console.log(chalk.gray('Deletion cancelled'));
                return;
            }
        }

        const response = await axios.delete(`${getServerUrl()}/api/user/family-diseases/${recordId}`, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            console.log(chalk.green('✓ Family disease record deleted successfully'));
        }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error(chalk.red('✗ Authentication token invalid'));
            console.log(chalk.gray('Use "diseasezone auth login" to log in again'));
        } else if (error.response && error.response.status === 404) {
            console.error(chalk.red('✗ Family disease record not found'));
        } else if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

async function info(recordId) {
    requireAuth();

    try {
        // Get the specific record
        const listResponse = await axios.get(`${getServerUrl()}/api/user/family-diseases`, {
            headers: getAuthHeaders()
        });

        if (!listResponse.data.success) {
            throw new Error('Failed to fetch family disease records');
        }

        const record = listResponse.data.family_diseases.find(r => r.id == recordId);
        if (!record) {
            console.error(chalk.red('✗ Family disease record not found'));
            process.exit(1);
        }

        console.log(chalk.cyan.bold(`👨‍👩‍👧‍👦 Family Disease Record #${record.id}`));
        console.log(chalk.gray('━'.repeat(50)));

        console.log(chalk.white('Disease:'), record.disease_name);
        console.log(chalk.white('Disease Code:'), record.disease_code);
        console.log(chalk.white('Family Member:'), record.family_member);
        if (record.family_member_name) {
            console.log(chalk.white('Name:'), record.family_member_name);
        }

        console.log(chalk.white('Has Disease:'), record.has_disease ? chalk.green('Yes') : chalk.red('No'));
        console.log(chalk.white('Diagnosis Confirmed:'), record.diagnosis_confirmed ? chalk.green('Yes') : chalk.yellow('No'));

        if (record.diagnosis_date) {
            console.log(chalk.white('Diagnosis Date:'), new Date(record.diagnosis_date).toLocaleDateString());
        }

        if (record.family_member_has_symptoms && record.family_member_has_symptoms.length > 0) {
            console.log(chalk.white('Current Symptoms:'));
            record.family_member_has_symptoms.forEach(symptom => {
                console.log(chalk.gray(`  • ${symptom}`));
            });
        }

        if (record.family_member_had_symptoms && record.family_member_had_symptoms.length > 0) {
            console.log(chalk.white('Past Symptoms:'));
            record.family_member_had_symptoms.forEach(symptom => {
                console.log(chalk.gray(`  • ${symptom}`));
            });
        }

        console.log(chalk.white('Has Children:'), record.family_member_has_children ? chalk.green('Yes') : chalk.red('No'));
        if (record.family_member_has_children) {
            console.log(chalk.white('Children Count:'), record.family_member_children_count || 0);
            console.log(chalk.white('Children Affected:'), record.family_member_children_have_disease ? chalk.red('Yes') : chalk.green('No'));
        }

        if (record.treatment_history && record.treatment_history.length > 0) {
            console.log(chalk.white('Treatment History:'));
            record.treatment_history.forEach(treatment => {
                console.log(chalk.gray(`  • ${treatment}`));
            });
        }

        if (record.family_member_disease_notes) {
            console.log(chalk.white('Notes:'));
            console.log(chalk.gray(record.family_member_disease_notes));
        }

        console.log(chalk.gray('\nRecord created:'), new Date(record.created_at).toLocaleString());
        console.log(chalk.gray('Last updated:'), new Date(record.updated_at).toLocaleString());

    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error(chalk.red('✗ Authentication token invalid'));
            console.log(chalk.gray('Use "diseasezone auth login" to log in again'));
        } else if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

module.exports = {
    list,
    add,
    update,
    delete: deleteRecord,
    info
};