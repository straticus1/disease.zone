#!/usr/bin/env node
/**
 * Hash Verification Script for diseaseZone Security
 *
 * Verifies the integrity of project files by comparing current hashes
 * with the stored hash file. This ensures the installation hasn't been
 * tampered with and matches the official GitHub repository.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const https = require('https');

class HashVerifier {
    constructor(projectRoot = process.cwd()) {
        this.projectRoot = projectRoot;
        this.hashAlgorithm = 'sha256';
        this.githubHashUrl = 'https://raw.githubusercontent.com/straticus1/disease.zone/main/HASHES.json';

        this.results = {
            verified: [],
            modified: [],
            missing: [],
            extra: [],
            errors: []
        };

        this.stats = {
            totalFiles: 0,
            verifiedFiles: 0,
            failedFiles: 0,
            startTime: Date.now()
        };
    }

    /**
     * Load hash data from file
     */
    loadHashFile(filePath = null) {
        const hashPath = filePath || path.join(this.projectRoot, 'HASHES.json');

        try {
            if (!fs.existsSync(hashPath)) {
                throw new Error(`Hash file not found: ${hashPath}`);
            }

            const hashData = JSON.parse(fs.readFileSync(hashPath, 'utf8'));

            if (!hashData.metadata || !hashData.hashes) {
                throw new Error('Invalid hash file format');
            }

            return hashData;
        } catch (error) {
            throw new Error(`Failed to load hash file: ${error.message}`);
        }
    }

    /**
     * Download official hash file from GitHub
     */
    async downloadGitHubHashes() {
        return new Promise((resolve, reject) => {
            console.log(chalk.blue('📥 Downloading official hashes from GitHub...'));

            https.get(this.githubHashUrl, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
                    return;
                }

                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        const hashData = JSON.parse(data);
                        resolve(hashData);
                    } catch (error) {
                        reject(new Error(`Invalid JSON from GitHub: ${error.message}`));
                    }
                });
            }).on('error', (error) => {
                reject(new Error(`Download failed: ${error.message}`));
            });
        });
    }

    /**
     * Calculate hash of a file
     */
    calculateFileHash(filePath) {
        try {
            const fileBuffer = fs.readFileSync(filePath);
            const hashSum = crypto.createHash(this.hashAlgorithm);
            hashSum.update(fileBuffer);
            return hashSum.digest('hex');
        } catch (error) {
            return null;
        }
    }

    /**
     * Get current file stats
     */
    getCurrentFileStats(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return {
                size: stats.size,
                modified: stats.mtime.toISOString(),
                permissions: '0' + (stats.mode & parseInt('777', 8)).toString(8),
                exists: true
            };
        } catch (error) {
            return { exists: false };
        }
    }

    /**
     * Verify a single file
     */
    verifyFile(relativePath, expectedData) {
        const fullPath = path.join(this.projectRoot, relativePath);
        const currentStats = this.getCurrentFileStats(fullPath);

        this.stats.totalFiles++;

        if (!currentStats.exists) {
            this.results.missing.push({
                file: relativePath,
                expected: expectedData
            });
            this.stats.failedFiles++;
            return false;
        }

        try {
            const currentHash = this.calculateFileHash(fullPath);

            if (currentHash === expectedData.hash) {
                this.results.verified.push({
                    file: relativePath,
                    hash: currentHash,
                    size: currentStats.size
                });
                this.stats.verifiedFiles++;
                return true;
            } else {
                this.results.modified.push({
                    file: relativePath,
                    expected: expectedData,
                    current: {
                        hash: currentHash,
                        size: currentStats.size,
                        modified: currentStats.modified
                    }
                });
                this.stats.failedFiles++;
                return false;
            }
        } catch (error) {
            this.results.errors.push({
                file: relativePath,
                error: error.message
            });
            this.stats.failedFiles++;
            return false;
        }
    }

    /**
     * Find extra files not in hash list
     */
    findExtraFiles(expectedFiles) {
        const HashGenerator = require('./generate-hashes');
        const generator = new HashGenerator(this.projectRoot);

        // Get current files (excluding same patterns as generator)
        const currentFiles = new Set();
        this.walkDirectoryForFiles('', currentFiles, generator);

        // Find files that exist but aren't in the hash file
        for (const file of currentFiles) {
            if (!expectedFiles.has(file)) {
                this.results.extra.push({
                    file: file,
                    current: this.getCurrentFileStats(path.join(this.projectRoot, file))
                });
            }
        }
    }

    /**
     * Walk directory to find all files (using same exclusion rules as generator)
     */
    walkDirectoryForFiles(basePath, fileSet, generator, dirPath = null) {
        const currentDir = dirPath || this.projectRoot;

        try {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });

            for (const entry of entries) {
                const relativePath = path.join(basePath, entry.name);

                if (generator.shouldExclude(relativePath)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    this.walkDirectoryForFiles(relativePath, fileSet, generator, path.join(currentDir, entry.name));
                } else if (entry.isFile()) {
                    fileSet.add(relativePath);
                }
            }
        } catch (error) {
            // Ignore directory read errors
        }
    }

    /**
     * Verify all files against hash data
     */
    verifyProject(hashData) {
        console.log(chalk.blue('🔍 Verifying project files against stored hashes...\n'));

        const expectedFiles = new Set(Object.keys(hashData.hashes));

        // Verify each expected file
        for (const [relativePath, expectedData] of Object.entries(hashData.hashes)) {
            this.verifyFile(relativePath, expectedData);
        }

        // Find extra files
        this.findExtraFiles(expectedFiles);

        this.stats.endTime = Date.now();
    }

    /**
     * Generate verification report
     */
    generateReport(hashData) {
        const report = {
            verification: {
                timestamp: new Date().toISOString(),
                projectVersion: hashData.metadata.version,
                hashFileGenerated: hashData.metadata.generated,
                algorithm: hashData.metadata.algorithm,
                verificationTime: this.stats.endTime - this.stats.startTime
            },
            summary: {
                totalFiles: this.stats.totalFiles,
                verifiedFiles: this.stats.verifiedFiles,
                failedFiles: this.stats.failedFiles,
                missingFiles: this.results.missing.length,
                modifiedFiles: this.results.modified.length,
                extraFiles: this.results.extra.length,
                errorFiles: this.results.errors.length,
                integrityStatus: this.getIntegrityStatus()
            },
            details: this.results
        };

        return report;
    }

    /**
     * Get overall integrity status
     */
    getIntegrityStatus() {
        if (this.results.modified.length > 0 ||
            this.results.missing.length > 0 ||
            this.results.errors.length > 0) {
            return 'COMPROMISED';
        } else if (this.results.extra.length > 0) {
            return 'MODIFIED';
        } else {
            return 'VERIFIED';
        }
    }

    /**
     * Display verification results
     */
    displayResults(report) {
        const status = report.summary.integrityStatus;

        console.log(chalk.blue.bold('🛡️  diseaseZone Integrity Verification Results\n'));

        // Status indicator
        if (status === 'VERIFIED') {
            console.log(chalk.green.bold('✅ INTEGRITY VERIFIED - Project is authentic and unmodified\n'));
        } else if (status === 'MODIFIED') {
            console.log(chalk.yellow.bold('⚠️  INTEGRITY MODIFIED - Extra files detected\n'));
        } else {
            console.log(chalk.red.bold('❌ INTEGRITY COMPROMISED - Critical files modified or missing\n'));
        }

        // Summary statistics
        console.log(chalk.cyan('📊 Verification Summary:'));
        console.log(`   Total Files Checked: ${chalk.white(report.summary.totalFiles)}`);
        console.log(`   Verified Files: ${chalk.green(report.summary.verifiedFiles)}`);
        console.log(`   Failed Verification: ${chalk.red(report.summary.failedFiles)}`);
        console.log(`   Missing Files: ${chalk.red(report.summary.missingFiles)}`);
        console.log(`   Modified Files: ${chalk.yellow(report.summary.modifiedFiles)}`);
        console.log(`   Extra Files: ${chalk.yellow(report.summary.extraFiles)}`);
        console.log(`   Verification Time: ${chalk.white(report.verification.verificationTime)}ms`);
        console.log();

        // Detailed results
        if (report.summary.modifiedFiles > 0) {
            console.log(chalk.red.bold('🔴 Modified Files:'));
            this.results.modified.forEach(item => {
                console.log(`   ${chalk.red(item.file)}`);
                console.log(`     Expected: ${item.expected.hash}`);
                console.log(`     Current:  ${item.current.hash}`);
                console.log(`     Size:     ${item.current.size} bytes`);
                console.log();
            });
        }

        if (report.summary.missingFiles > 0) {
            console.log(chalk.red.bold('🔴 Missing Files:'));
            this.results.missing.forEach(item => {
                console.log(`   ${chalk.red(item.file)}`);
                console.log(`     Expected Size: ${item.expected.size} bytes`);
                console.log();
            });
        }

        if (report.summary.extraFiles > 0) {
            console.log(chalk.yellow.bold('🟡 Extra Files (not in original hash):'));
            this.results.extra.forEach(item => {
                console.log(`   ${chalk.yellow(item.file)}`);
                if (item.current.exists) {
                    console.log(`     Size: ${item.current.size} bytes`);
                }
                console.log();
            });
        }

        if (report.summary.errorFiles > 0) {
            console.log(chalk.red.bold('🔴 Verification Errors:'));
            this.results.errors.forEach(item => {
                console.log(`   ${chalk.red(item.file)}: ${item.error}`);
            });
            console.log();
        }

        // Security recommendations
        console.log(chalk.blue.bold('🔒 Security Recommendations:'));

        if (status === 'VERIFIED') {
            console.log(chalk.green('   ✅ Your installation is verified and secure.'));
            console.log(chalk.green('   ✅ All files match the official GitHub repository.'));
        } else if (status === 'MODIFIED') {
            console.log(chalk.yellow('   ⚠️  Extra files detected - review for security implications.'));
            console.log(chalk.yellow('   ⚠️  Consider regenerating hashes if changes are intentional.'));
        } else {
            console.log(chalk.red('   ❌ SECURITY ALERT: Files have been modified or are missing!'));
            console.log(chalk.red('   ❌ Do NOT use this installation for sensitive medical data.'));
            console.log(chalk.red('   ❌ Re-download from official GitHub: https://github.com/straticus1/disease.zone'));
        }
        console.log();
    }

    /**
     * Save verification report
     */
    saveReport(report) {
        const reportPath = path.join(this.projectRoot, 'VERIFICATION_REPORT.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log(chalk.gray(`📄 Verification report saved: ${reportPath}`));
        return reportPath;
    }

    /**
     * Compare with GitHub official hashes
     */
    async compareWithGitHub() {
        try {
            console.log(chalk.blue.bold('🌐 Comparing with official GitHub repository...\n'));

            const githubHashes = await this.downloadGitHubHashes();
            const localHashPath = path.join(this.projectRoot, 'HASHES.json');

            if (fs.existsSync(localHashPath)) {
                const localHashes = this.loadHashFile(localHashPath);

                if (githubHashes.metadata.projectHash === localHashes.metadata.projectHash) {
                    console.log(chalk.green('✅ Local hash file matches GitHub repository\n'));
                    return { match: true, githubHashes, localHashes };
                } else {
                    console.log(chalk.red('❌ Local hash file differs from GitHub repository\n'));
                    console.log(chalk.yellow('This could indicate:'));
                    console.log(chalk.yellow('- Your local files have been modified'));
                    console.log(chalk.yellow('- You have a different version than GitHub'));
                    console.log(chalk.yellow('- The GitHub repository has been updated\n'));
                    return { match: false, githubHashes, localHashes };
                }
            } else {
                console.log(chalk.yellow('⚠️  No local hash file found, using GitHub hashes for verification\n'));
                return { match: null, githubHashes, localHashes: null };
            }
        } catch (error) {
            console.log(chalk.red(`❌ Failed to compare with GitHub: ${error.message}\n`));
            return { match: false, error: error.message };
        }
    }
}

// Main execution functions
async function verifyLocal(options = {}) {
    try {
        const verifier = new HashVerifier();

        console.log(chalk.blue.bold('🔍 Local Hash Verification\n'));

        const hashData = verifier.loadHashFile(options.hashFile);
        verifier.verifyProject(hashData);

        const report = verifier.generateReport(hashData);
        verifier.displayResults(report);

        if (options.saveReport !== false) {
            verifier.saveReport(report);
        }

        return report;
    } catch (error) {
        console.error(chalk.red.bold('❌ Verification failed:'), error.message);
        process.exit(1);
    }
}

async function verifyWithGitHub(options = {}) {
    try {
        const verifier = new HashVerifier();

        console.log(chalk.blue.bold('🌐 GitHub Repository Verification\n'));

        const comparison = await verifier.compareWithGitHub();

        if (comparison.githubHashes) {
            verifier.verifyProject(comparison.githubHashes);
            const report = verifier.generateReport(comparison.githubHashes);

            // Add GitHub comparison info to report
            report.githubComparison = {
                downloadSuccessful: true,
                hashFileMatch: comparison.match,
                comparedAt: new Date().toISOString()
            };

            verifier.displayResults(report);

            if (options.saveReport !== false) {
                verifier.saveReport(report);
            }

            return report;
        } else {
            throw new Error('Failed to download GitHub hashes');
        }
    } catch (error) {
        console.error(chalk.red.bold('❌ GitHub verification failed:'), error.message);
        process.exit(1);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const options = {};

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--github':
            case '-g':
                options.useGitHub = true;
                break;
            case '--hash-file':
            case '-f':
                options.hashFile = args[++i];
                break;
            case '--no-report':
                options.saveReport = false;
                break;
            case '--help':
            case '-h':
                showHelp();
                return;
        }
    }

    try {
        if (options.useGitHub) {
            await verifyWithGitHub(options);
        } else {
            await verifyLocal(options);
        }

        console.log(chalk.green.bold('🎉 Verification complete!'));
    } catch (error) {
        console.error(chalk.red.bold('❌ Verification process failed:'), error.message);
        process.exit(1);
    }
}

function showHelp() {
    console.log(chalk.blue.bold('🛡️  diseaseZone Hash Verification Tool\n'));
    console.log('Usage: node scripts/verify-hashes.js [options]\n');
    console.log('Options:');
    console.log('  -g, --github        Compare with official GitHub repository');
    console.log('  -f, --hash-file     Specify custom hash file path');
    console.log('  --no-report         Don\'t save verification report');
    console.log('  -h, --help          Show this help message\n');
    console.log('Examples:');
    console.log('  node scripts/verify-hashes.js                    # Verify against local HASHES.json');
    console.log('  node scripts/verify-hashes.js --github           # Verify against GitHub repository');
    console.log('  node scripts/verify-hashes.js -f custom.json     # Use custom hash file\n');
}

// Export for programmatic use
module.exports = { HashVerifier, verifyLocal, verifyWithGitHub };

// Run if called directly
if (require.main === module) {
    main();
}