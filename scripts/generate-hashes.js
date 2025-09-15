#!/usr/bin/env node
/**
 * Hash Generation Script for diseaseZone Security Verification
 *
 * Generates cryptographic hashes for all project files to ensure integrity.
 * This enhances security by allowing users to verify their installation
 * matches the official GitHub repository.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class HashGenerator {
    constructor(projectRoot = process.cwd()) {
        this.projectRoot = projectRoot;
        this.hashAlgorithm = 'sha256';
        this.excludePatterns = [
            // Version control
            /^\.git/,
            /^\.gitignore$/,

            // Dependencies and build artifacts
            /^node_modules/,
            /^dist/,
            /^build/,
            /^coverage/,

            // Logs and temporary files
            /\.log$/,
            /^logs/,
            /^tmp/,
            /^temp/,
            /\.tmp$/,
            /\.temp$/,

            // Development files
            /^\.vscode/,
            /^\.idea/,
            /\.swp$/,
            /\.swo$/,
            /^\.DS_Store$/,

            // Environment and configuration
            /^\.env/,
            /^\.diseasezone$/,

            // Database files (contain user data)
            /\.db$/,
            /\.sqlite$/,
            /\.sqlite3$/,
            /^database\/.*\.db$/,

            // Security and certificates
            /\.key$/,
            /\.pem$/,
            /\.crt$/,
            /\.p12$/,
            /^secrets/,
            /^certificates/,

            // Hash files themselves
            /^HASHES\.json$/,
            /^HASHES\.txt$/,
            /^scripts\/generate-hashes\.js$/,
            /^scripts\/verify-hashes\.js$/,

            // Backup files
            /\.backup$/,
            /\.bak$/,
            /^backups/,

            // Medical data directories
            /^phi-data/,
            /^patient-data/,
            /^medical-records/,
            /^test-data/,
            /^mock-data/,

            // Security scan results
            /^audit-logs/,
            /^compliance-reports/,
            /^security-scans/,

            // Terraform state
            /\.tfstate/,
            /\.tfplan$/
        ];

        this.hashes = {};
        this.stats = {
            totalFiles: 0,
            hashedFiles: 0,
            skippedFiles: 0,
            totalSize: 0,
            startTime: Date.now()
        };
    }

    /**
     * Check if file should be excluded from hashing
     */
    shouldExclude(relativePath) {
        return this.excludePatterns.some(pattern => pattern.test(relativePath));
    }

    /**
     * Calculate SHA256 hash of a file
     */
    calculateFileHash(filePath) {
        try {
            const fileBuffer = fs.readFileSync(filePath);
            const hashSum = crypto.createHash(this.hashAlgorithm);
            hashSum.update(fileBuffer);
            return hashSum.digest('hex');
        } catch (error) {
            console.warn(chalk.yellow(`Warning: Could not hash file ${filePath}: ${error.message}`));
            return null;
        }
    }

    /**
     * Get file stats for verification
     */
    getFileStats(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return {
                size: stats.size,
                modified: stats.mtime.toISOString(),
                permissions: '0' + (stats.mode & parseInt('777', 8)).toString(8)
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Recursively walk directory and hash files
     */
    walkDirectory(dirPath, basePath = '') {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.join(basePath, entry.name);

            this.stats.totalFiles++;

            // Skip excluded files/directories
            if (this.shouldExclude(relativePath)) {
                this.stats.skippedFiles++;
                continue;
            }

            if (entry.isDirectory()) {
                // Recursively process subdirectory
                this.walkDirectory(fullPath, relativePath);
            } else if (entry.isFile()) {
                // Calculate hash for file
                const fileHash = this.calculateFileHash(fullPath);
                if (fileHash) {
                    const fileStats = this.getFileStats(fullPath);

                    this.hashes[relativePath] = {
                        hash: fileHash,
                        algorithm: this.hashAlgorithm,
                        size: fileStats?.size || 0,
                        modified: fileStats?.modified,
                        permissions: fileStats?.permissions
                    };

                    this.stats.hashedFiles++;
                    this.stats.totalSize += fileStats?.size || 0;
                }
            }
        }
    }

    /**
     * Generate hashes for all project files
     */
    generateHashes() {
        console.log(chalk.blue.bold('🔒 Generating security hashes for diseaseZone project...\n'));

        try {
            // Walk the project directory
            this.walkDirectory(this.projectRoot);

            // Calculate project-wide hash
            const projectData = JSON.stringify(this.hashes, null, 2);
            const projectHash = crypto.createHash(this.hashAlgorithm).update(projectData).digest('hex');

            // Create final hash object
            const hashData = {
                metadata: {
                    project: 'diseaseZone',
                    version: this.getProjectVersion(),
                    generated: new Date().toISOString(),
                    generator: 'diseaseZone Security Hash Generator v1.0',
                    algorithm: this.hashAlgorithm,
                    projectHash: projectHash,
                    stats: {
                        totalFiles: this.stats.totalFiles,
                        hashedFiles: this.stats.hashedFiles,
                        skippedFiles: this.stats.skippedFiles,
                        totalSize: this.stats.totalSize,
                        generationTime: Date.now() - this.stats.startTime
                    }
                },
                hashes: this.hashes
            };

            return hashData;

        } catch (error) {
            console.error(chalk.red('Error generating hashes:'), error.message);
            throw error;
        }
    }

    /**
     * Get project version from package.json
     */
    getProjectVersion() {
        try {
            const packagePath = path.join(this.projectRoot, 'package.json');
            const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            return packageData.version;
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Save hashes to files
     */
    saveHashes(hashData) {
        const hashesJsonPath = path.join(this.projectRoot, 'HASHES.json');
        const hashesTextPath = path.join(this.projectRoot, 'HASHES.txt');

        // Save JSON format
        fs.writeFileSync(hashesJsonPath, JSON.stringify(hashData, null, 2));

        // Save human-readable text format
        let textContent = `diseaseZone Security Hash Verification File\n`;
        textContent += `==========================================\n\n`;
        textContent += `Project: ${hashData.metadata.project}\n`;
        textContent += `Version: ${hashData.metadata.version}\n`;
        textContent += `Generated: ${hashData.metadata.generated}\n`;
        textContent += `Algorithm: ${hashData.metadata.algorithm.toUpperCase()}\n`;
        textContent += `Project Hash: ${hashData.metadata.projectHash}\n\n`;
        textContent += `Statistics:\n`;
        textContent += `- Total Files: ${hashData.metadata.stats.totalFiles}\n`;
        textContent += `- Hashed Files: ${hashData.metadata.stats.hashedFiles}\n`;
        textContent += `- Skipped Files: ${hashData.metadata.stats.skippedFiles}\n`;
        textContent += `- Total Size: ${this.formatBytes(hashData.metadata.stats.totalSize)}\n`;
        textContent += `- Generation Time: ${hashData.metadata.stats.generationTime}ms\n\n`;
        textContent += `File Hashes:\n`;
        textContent += `============\n\n`;

        // Sort files alphabetically for consistent output
        const sortedFiles = Object.keys(hashData.hashes).sort();
        for (const file of sortedFiles) {
            const fileData = hashData.hashes[file];
            textContent += `${file}\n`;
            textContent += `  Hash: ${fileData.hash}\n`;
            textContent += `  Size: ${this.formatBytes(fileData.size)}\n`;
            textContent += `  Modified: ${fileData.modified}\n`;
            textContent += `  Permissions: ${fileData.permissions}\n\n`;
        }

        fs.writeFileSync(hashesTextPath, textContent);

        return { hashesJsonPath, hashesTextPath };
    }

    /**
     * Format bytes in human-readable format
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Display generation results
     */
    displayResults(hashData, filePaths) {
        console.log(chalk.green.bold('✅ Hash generation completed successfully!\n'));

        console.log(chalk.cyan('📊 Statistics:'));
        console.log(`   Total Files Scanned: ${chalk.white(hashData.metadata.stats.totalFiles)}`);
        console.log(`   Files Hashed: ${chalk.green(hashData.metadata.stats.hashedFiles)}`);
        console.log(`   Files Skipped: ${chalk.yellow(hashData.metadata.stats.skippedFiles)}`);
        console.log(`   Total Size: ${chalk.white(this.formatBytes(hashData.metadata.stats.totalSize))}`);
        console.log(`   Generation Time: ${chalk.white(hashData.metadata.stats.generationTime)}ms`);
        console.log();

        console.log(chalk.cyan('🔒 Security Information:'));
        console.log(`   Algorithm: ${chalk.white(hashData.metadata.algorithm.toUpperCase())}`);
        console.log(`   Project Hash: ${chalk.white(hashData.metadata.projectHash)}`);
        console.log();

        console.log(chalk.cyan('📁 Output Files:'));
        console.log(`   JSON Format: ${chalk.white(filePaths.hashesJsonPath)}`);
        console.log(`   Text Format: ${chalk.white(filePaths.hashesTextPath)}`);
        console.log();

        console.log(chalk.blue.bold('🛡️  Security Verification:'));
        console.log('   Users can verify their installation by running:');
        console.log(chalk.white('   node scripts/verify-hashes.js'));
        console.log();
        console.log('   Or compare with official GitHub hashes:');
        console.log(chalk.white('   https://github.com/straticus1/disease.zone/blob/main/HASHES.json'));
        console.log();
    }
}

// Main execution
async function main() {
    try {
        const generator = new HashGenerator();

        console.log(chalk.blue.bold('🧬 diseaseZone Security Hash Generator\n'));
        console.log(chalk.gray('Generating cryptographic hashes for project integrity verification...\n'));

        const hashData = generator.generateHashes();
        const filePaths = generator.saveHashes(hashData);

        generator.displayResults(hashData, filePaths);

        console.log(chalk.green.bold('🎉 Hash generation complete! Your project is now secured with integrity verification.'));

    } catch (error) {
        console.error(chalk.red.bold('❌ Hash generation failed:'), error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = HashGenerator;