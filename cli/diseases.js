const chalk = require('chalk');
const axios = require('axios');

function getServerUrl() {
    return global.dzConfig.server_url || 'http://localhost:3000';
}

function getAuthHeaders() {
    return global.dzConfig.auth_token ? {
        'Authorization': `Bearer ${global.dzConfig.auth_token}`
    } : {};
}

function formatTable(data, columns) {
    if (!data || data.length === 0) {
        console.log(chalk.gray('No data found'));
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

async function list(options) {
    try {
        let url = `${getServerUrl()}/api/diseases`;
        const params = new URLSearchParams();

        if (options.category) {
            url = `${getServerUrl()}/api/diseases/category/${encodeURIComponent(options.category)}`;
        }
        if (options.search) {
            params.append('search', options.search);
        }
        if (options.limit) {
            params.append('limit', options.limit);
        }

        if (params.toString()) {
            url += '?' + params.toString();
        }

        const response = await axios.get(url, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            const diseases = response.data.diseases;

            console.log(chalk.cyan.bold(`🦠 Disease Registry (${diseases.length} diseases)`));
            console.log(chalk.gray('━'.repeat(50)));

            formatTable(diseases, [
                { header: 'ID', key: 'disease_code', maxWidth: 15 },
                { header: 'Name', key: 'name', maxWidth: 30 },
                { header: 'Category', key: 'category', maxWidth: 20 },
                { header: 'ICD-10', key: 'icd10_code', maxWidth: 10 },
                { header: 'Inheritance', key: 'inheritance_pattern', maxWidth: 15 }
            ]);

            if (options.search || options.category) {
                console.log(chalk.gray(`\nShowing filtered results. Use "diseasezone diseases list" to see all diseases.`));
            }
        }
    } catch (error) {
        if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

async function info(diseaseId) {
    try {
        let url;
        if (/^\d+$/.test(diseaseId)) {
            url = `${getServerUrl()}/api/diseases/${diseaseId}`;
        } else {
            // Search by name or disease code
            const searchResponse = await axios.get(`${getServerUrl()}/api/diseases?search=${encodeURIComponent(diseaseId)}`, {
                headers: getAuthHeaders()
            });

            if (!searchResponse.data.success || searchResponse.data.diseases.length === 0) {
                console.error(chalk.red('✗ Disease not found'));
                process.exit(1);
            }

            const disease = searchResponse.data.diseases[0];
            url = `${getServerUrl()}/api/diseases/${disease.id}`;
        }

        const response = await axios.get(url, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            const disease = response.data.disease;

            console.log(chalk.cyan.bold(`🦠 ${disease.name}`));
            console.log(chalk.gray('━'.repeat(50)));
            console.log(chalk.white('Disease Code:'), disease.disease_code);
            console.log(chalk.white('Category:'), disease.category);
            console.log(chalk.white('ICD-10 Code:'), disease.icd10_code || 'Not specified');
            console.log(chalk.white('Inheritance Pattern:'), disease.inheritance_pattern || 'Not specified');

            if (disease.description) {
                console.log(chalk.white('Description:'));
                console.log(chalk.gray(disease.description));
            }

            if (disease.symptoms && disease.symptoms.length > 0) {
                console.log(chalk.white('Common Symptoms:'));
                disease.symptoms.forEach(symptom => {
                    console.log(chalk.gray(`  • ${symptom}`));
                });
            }

            if (disease.risk_factors && disease.risk_factors.length > 0) {
                console.log(chalk.white('Risk Factors:'));
                disease.risk_factors.forEach(factor => {
                    console.log(chalk.gray(`  • ${factor}`));
                });
            }

            if (disease.prevalence_data) {
                console.log(chalk.white('Prevalence:'), disease.prevalence_data);
            }

            console.log(chalk.gray('\nLast updated:'), new Date(disease.updated_at).toLocaleDateString());
        }
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.error(chalk.red('✗ Disease not found'));
        } else if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

async function categories() {
    try {
        const response = await axios.get(`${getServerUrl()}/api/diseases`, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            const diseases = response.data.diseases;
            const categoryStats = {};

            diseases.forEach(disease => {
                const category = disease.category;
                if (!categoryStats[category]) {
                    categoryStats[category] = {
                        count: 0,
                        diseases: []
                    };
                }
                categoryStats[category].count++;
                categoryStats[category].diseases.push(disease.name);
            });

            console.log(chalk.cyan.bold('🦠 Disease Categories'));
            console.log(chalk.gray('━'.repeat(50)));

            Object.entries(categoryStats)
                .sort(([,a], [,b]) => b.count - a.count)
                .forEach(([category, stats]) => {
                    console.log(chalk.white(`${category}:`), chalk.cyan(`${stats.count} diseases`));
                    if (global.dzConfig.verbose) {
                        stats.diseases.slice(0, 3).forEach(disease => {
                            console.log(chalk.gray(`  • ${disease}`));
                        });
                        if (stats.diseases.length > 3) {
                            console.log(chalk.gray(`  • ... and ${stats.diseases.length - 3} more`));
                        }
                    }
                });

            console.log(chalk.gray(`\nTotal: ${diseases.length} diseases across ${Object.keys(categoryStats).length} categories`));
            console.log(chalk.gray('Use --verbose flag to see disease examples in each category'));
        }
    } catch (error) {
        if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

async function search(options) {
    try {
        const params = new URLSearchParams();

        if (options.query) params.append('search', options.query);
        if (options.category) params.append('category', options.category);
        if (options.icd10) params.append('icd10', options.icd10);
        if (options.inheritance) params.append('inheritance', options.inheritance);

        const url = `${getServerUrl()}/api/diseases?${params.toString()}`;

        const response = await axios.get(url, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            const diseases = response.data.diseases;

            console.log(chalk.cyan.bold(`🔍 Disease Search Results (${diseases.length} found)`));
            console.log(chalk.gray('━'.repeat(50)));

            if (diseases.length === 0) {
                console.log(chalk.gray('No diseases found matching your criteria.'));
                console.log(chalk.gray('Try using broader search terms or different filters.'));
                return;
            }

            formatTable(diseases, [
                { header: 'ID', key: 'disease_code', maxWidth: 15 },
                { header: 'Name', key: 'name', maxWidth: 35 },
                { header: 'Category', key: 'category', maxWidth: 20 },
                { header: 'ICD-10', key: 'icd10_code', maxWidth: 10 }
            ]);

            console.log(chalk.gray(`\nUse "diseasezone diseases info <disease-id>" for detailed information`));
        }
    } catch (error) {
        if (error.response) {
            console.error(chalk.red('✗ Error:'), error.response.data.error || error.response.data.message);
        } else {
            console.error(chalk.red('✗ Error:'), error.message);
        }
        process.exit(1);
    }
}

module.exports = {
    list,
    info,
    categories,
    search
};