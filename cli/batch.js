const chalk = require('chalk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Transform } = require('stream');

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

function validateFileExists(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(chalk.red('✗ File not found:'), filePath);
        process.exit(1);
    }
}

function getFileExtension(filePath) {
    return path.extname(filePath).toLowerCase();
}

async function readJsonFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`Failed to parse JSON file: ${error.message}`);
    }
}

async function readCsvFile(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        const errors = [];

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
                results.push(data);
            })
            .on('error', (error) => {
                errors.push(error);
            })
            .on('end', () => {
                if (errors.length > 0) {
                    reject(new Error(`CSV parsing errors: ${errors.map(e => e.message).join(', ')}`));
                } else {
                    resolve(results);
                }
            });
    });
}

function validateFamilyDiseaseRecord(record, index) {
    const errors = [];

    if (!record.disease_id) {
        errors.push(`Row ${index + 1}: disease_id is required`);
    } else if (isNaN(parseInt(record.disease_id))) {
        errors.push(`Row ${index + 1}: disease_id must be a number`);
    }

    if (!record.family_member) {
        errors.push(`Row ${index + 1}: family_member is required`);
    }

    const validFamilyMembers = ['mother', 'father', 'sibling', 'child', 'grandmother', 'grandfather', 'aunt', 'uncle', 'cousin', 'spouse'];
    if (record.family_member && !validFamilyMembers.includes(record.family_member.toLowerCase())) {
        errors.push(`Row ${index + 1}: family_member must be one of: ${validFamilyMembers.join(', ')}`);
    }

    // Validate boolean fields
    const booleanFields = ['has_disease', 'diagnosis_confirmed', 'family_member_has_children', 'family_member_children_have_disease'];
    booleanFields.forEach(field => {
        if (record[field] && !['true', 'false', '1', '0', 'yes', 'no'].includes(String(record[field]).toLowerCase())) {
            errors.push(`Row ${index + 1}: ${field} must be true/false, 1/0, or yes/no`);
        }
    });

    // Validate date format
    if (record.diagnosis_date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(record.diagnosis_date)) {
            errors.push(`Row ${index + 1}: diagnosis_date must be in YYYY-MM-DD format`);
        }
    }

    return errors;
}

function normalizeFamilyDiseaseRecord(record) {
    const normalized = { ...record };

    // Convert boolean fields
    const booleanFields = ['has_disease', 'diagnosis_confirmed', 'family_member_has_children', 'family_member_children_have_disease'];
    booleanFields.forEach(field => {
        if (normalized[field]) {
            const value = String(normalized[field]).toLowerCase();
            normalized[field] = ['true', '1', 'yes'].includes(value);
        }
    });

    // Convert numeric fields
    if (normalized.disease_id) {
        normalized.disease_id = parseInt(normalized.disease_id);
    }
    if (normalized.family_member_children_count) {
        normalized.family_member_children_count = parseInt(normalized.family_member_children_count) || 0;
    }

    // Parse array fields (comma-separated strings)
    const arrayFields = ['family_member_has_symptoms', 'family_member_had_symptoms', 'treatment_history'];
    arrayFields.forEach(field => {
        if (normalized[field] && typeof normalized[field] === 'string') {
            normalized[field] = normalized[field].split(',').map(item => item.trim()).filter(item => item);
        }
    });

    // Ensure required defaults
    normalized.has_disease = normalized.has_disease !== undefined ? normalized.has_disease : true;
    normalized.diagnosis_confirmed = normalized.diagnosis_confirmed !== undefined ? normalized.diagnosis_confirmed : false;
    normalized.family_member_has_children = normalized.family_member_has_children !== undefined ? normalized.family_member_has_children : false;
    normalized.family_member_children_count = normalized.family_member_children_count || 0;
    normalized.family_member_children_have_disease = normalized.family_member_children_have_disease !== undefined ? normalized.family_member_children_have_disease : false;

    return normalized;
}

async function importData(filePath, options) {
    requireAuth();
    validateFileExists(filePath);

    const fileExt = getFileExtension(filePath);
    const dataType = options.type || 'family-diseases';

    try {
        let data;

        console.log(chalk.cyan('🚀 Experimental Batch Import'));
        console.log(chalk.gray('━'.repeat(40)));
        console.log(chalk.white('File:'), filePath);
        console.log(chalk.white('Type:'), dataType);
        console.log(chalk.white('Format:'), fileExt === '.json' ? 'JSON' : 'CSV');

        // Read file based on extension
        if (fileExt === '.json') {
            data = await readJsonFile(filePath);
            if (!Array.isArray(data)) {
                console.error(chalk.red('✗ JSON file must contain an array of records'));
                process.exit(1);
            }
        } else if (fileExt === '.csv') {
            data = await readCsvFile(filePath);
        } else {
            console.error(chalk.red('✗ Unsupported file format. Use .json or .csv files'));
            process.exit(1);
        }

        console.log(chalk.white('Records found:'), data.length);

        if (dataType !== 'family-diseases') {
            console.error(chalk.red('✗ Unsupported data type. Currently only "family-diseases" is supported'));
            process.exit(1);
        }

        // Validate all records
        console.log(chalk.cyan('\nValidating records...'));
        const allErrors = [];
        const validRecords = [];

        for (let i = 0; i < data.length; i++) {
            const record = data[i];
            const errors = validateFamilyDiseaseRecord(record, i);

            if (errors.length > 0) {
                allErrors.push(...errors);
            } else {
                validRecords.push(normalizeFamilyDiseaseRecord(record));
            }
        }

        if (allErrors.length > 0) {
            console.error(chalk.red(`✗ Validation failed (${allErrors.length} errors):`));
            allErrors.forEach(error => {
                console.error(chalk.red('  •'), error);
            });

            if (!options.validateOnly) {
                console.log(chalk.gray('Use --validate-only flag to check format without importing'));
            }
            process.exit(1);
        }

        console.log(chalk.green(`✓ All ${validRecords.length} records are valid`));

        if (options.validateOnly) {
            console.log(chalk.green('✓ Validation complete - no errors found'));
            return;
        }

        if (options.dryRun) {
            console.log(chalk.cyan('\n🔍 Dry Run Preview:'));
            console.log(chalk.gray('The following records would be imported:'));
            validRecords.slice(0, 5).forEach((record, index) => {
                console.log(chalk.gray(`  ${index + 1}. Disease ID ${record.disease_id} for ${record.family_member}${record.family_member_name ? ' (' + record.family_member_name + ')' : ''}`));
            });
            if (validRecords.length > 5) {
                console.log(chalk.gray(`  ... and ${validRecords.length - 5} more records`));
            }
            return;
        }

        // Import records
        console.log(chalk.cyan('\nImporting records...'));
        const results = {
            success: 0,
            errors: 0,
            errorDetails: []
        };

        for (let i = 0; i < validRecords.length; i++) {
            const record = validRecords[i];

            try {
                const response = await axios.post(`${getServerUrl()}/api/user/family-diseases`, record, {
                    headers: getAuthHeaders()
                });

                if (response.data.success) {
                    results.success++;
                    process.stdout.write(chalk.green('.'));
                } else {
                    results.errors++;
                    results.errorDetails.push(`Record ${i + 1}: ${response.data.error || 'Unknown error'}`);
                    process.stdout.write(chalk.red('E'));
                }
            } catch (error) {
                results.errors++;
                const errorMsg = error.response?.data?.error || error.message;
                results.errorDetails.push(`Record ${i + 1}: ${errorMsg}`);
                process.stdout.write(chalk.red('E'));
            }

            // Progress indicator every 10 records
            if ((i + 1) % 10 === 0) {
                process.stdout.write(chalk.gray(` ${i + 1}/${validRecords.length}\n`));
            }
        }

        console.log('\n');
        console.log(chalk.cyan('Import Summary:'));
        console.log(chalk.green('✓ Successful:'), results.success);
        console.log(chalk.red('✗ Failed:'), results.errors);

        if (results.errorDetails.length > 0) {
            console.log(chalk.red('\nError Details:'));
            results.errorDetails.slice(0, 10).forEach(error => {
                console.error(chalk.red('  •'), error);
            });
            if (results.errorDetails.length > 10) {
                console.log(chalk.red(`  • ... and ${results.errorDetails.length - 10} more errors`));
            }
        }

    } catch (error) {
        console.error(chalk.red('✗ Import failed:'), error.message);
        process.exit(1);
    }
}

async function exportData(outputFile, options) {
    requireAuth();

    const dataType = options.type || 'family-diseases';
    const format = options.format || getFileExtension(outputFile).substring(1) || 'json';

    try {
        console.log(chalk.cyan('📤 Data Export'));
        console.log(chalk.gray('━'.repeat(30)));
        console.log(chalk.white('Output:'), outputFile);
        console.log(chalk.white('Type:'), dataType);
        console.log(chalk.white('Format:'), format);

        let data;
        let endpoint;

        switch (dataType) {
            case 'family-diseases':
                endpoint = '/api/user/family-diseases';
                break;
            case 'diseases':
                endpoint = '/api/diseases';
                break;
            case 'profile':
                endpoint = '/api/user/profile';
                break;
            default:
                console.error(chalk.red('✗ Unsupported data type:'), dataType);
                console.log(chalk.gray('Supported types: family-diseases, diseases, profile'));
                process.exit(1);
        }

        const response = await axios.get(`${getServerUrl()}${endpoint}`, {
            headers: getAuthHeaders()
        });

        if (!response.data.success) {
            throw new Error('Failed to fetch data from server');
        }

        // Extract the data based on type
        if (dataType === 'profile') {
            data = [response.data.user];
        } else if (dataType === 'family-diseases') {
            data = response.data.family_diseases;
        } else if (dataType === 'diseases') {
            data = response.data.diseases;
        }

        console.log(chalk.white('Records:'), data.length);

        // Write data in requested format
        if (format === 'json') {
            fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
        } else if (format === 'csv') {
            if (data.length === 0) {
                fs.writeFileSync(outputFile, '');
            } else {
                // Get all unique keys from all objects
                const allKeys = new Set();
                data.forEach(record => {
                    Object.keys(record).forEach(key => allKeys.add(key));
                });

                const headers = Array.from(allKeys);
                const csvLines = [headers.join(',')];

                data.forEach(record => {
                    const values = headers.map(header => {
                        let value = record[header] || '';
                        if (Array.isArray(value)) {
                            value = value.join(';'); // Use semicolon for array items in CSV
                        }
                        return `"${String(value).replace(/"/g, '""')}"`;
                    });
                    csvLines.push(values.join(','));
                });

                fs.writeFileSync(outputFile, csvLines.join('\n'));
            }
        } else {
            console.error(chalk.red('✗ Unsupported format:'), format);
            console.log(chalk.gray('Supported formats: json, csv'));
            process.exit(1);
        }

        console.log(chalk.green('✓ Export completed successfully'));

    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error(chalk.red('✗ Authentication token invalid'));
            console.log(chalk.gray('Use "diseasezone auth login" to log in again'));
        } else if (error.response) {
            console.error(chalk.red('✗ Export failed:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Export failed:'), error.message);
        }
        process.exit(1);
    }
}

async function generateTemplate(type, outputFile, options) {
    const format = options.format || getFileExtension(outputFile).substring(1) || 'json';

    if (type !== 'family-diseases') {
        console.error(chalk.red('✗ Unsupported template type:'), type);
        console.log(chalk.gray('Supported types: family-diseases'));
        process.exit(1);
    }

    console.log(chalk.cyan('📄 Template Generation'));
    console.log(chalk.gray('━'.repeat(30)));
    console.log(chalk.white('Type:'), type);
    console.log(chalk.white('Format:'), format);
    console.log(chalk.white('Output:'), outputFile);

    const sampleRecord = {
        disease_id: 1,
        family_member: 'mother',
        family_member_name: 'Mary Smith',
        has_disease: true,
        diagnosis_confirmed: true,
        diagnosis_date: '2020-05-15',
        family_member_has_symptoms: ['pain', 'stiffness'],
        family_member_had_symptoms: ['swelling'],
        family_member_has_children: true,
        family_member_children_count: 2,
        family_member_children_have_disease: false,
        family_member_disease_notes: 'Diagnosed at age 45, managed with medication',
        treatment_history: ['medication', 'physical_therapy']
    };

    if (format === 'json') {
        const template = [sampleRecord];
        fs.writeFileSync(outputFile, JSON.stringify(template, null, 2));
    } else if (format === 'csv') {
        const headers = Object.keys(sampleRecord);
        const csvLines = [headers.join(',')];

        const values = headers.map(header => {
            let value = sampleRecord[header];
            if (Array.isArray(value)) {
                value = value.join(';'); // Use semicolon for array items in CSV
            }
            return `"${String(value).replace(/"/g, '""')}"`;
        });
        csvLines.push(values.join(','));

        fs.writeFileSync(outputFile, csvLines.join('\n'));
    } else {
        console.error(chalk.red('✗ Unsupported format:'), format);
        console.log(chalk.gray('Supported formats: json, csv'));
        process.exit(1);
    }

    console.log(chalk.green('✓ Template generated successfully'));
    console.log(chalk.gray('\nField descriptions:'));
    console.log(chalk.gray('  disease_id: ID of the disease from the registry'));
    console.log(chalk.gray('  family_member: Relationship (mother, father, sibling, etc.)'));
    console.log(chalk.gray('  has_disease: true/false if family member has the disease'));
    console.log(chalk.gray('  diagnosis_confirmed: true/false if diagnosis is confirmed'));
    console.log(chalk.gray('  diagnosis_date: Date in YYYY-MM-DD format'));
    console.log(chalk.gray('  symptoms: Comma-separated list (CSV) or array (JSON)'));
    console.log(chalk.gray('  treatment_history: Comma-separated list (CSV) or array (JSON)'));
}

module.exports = {
    import: importData,
    export: exportData,
    template: generateTemplate
};