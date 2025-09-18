#!/usr/bin/env node

/**
 * Medical File Scanning Daemon Runner
 * 
 * Standalone process for the medical file scanning daemon
 * Can be run independently of the main application
 */

const MedicalFileScanDaemon = require('./services/medicalFileScanDaemon');
const chalk = require('chalk');

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'start';

class ScanDaemonRunner {
  constructor() {
    this.daemon = new MedicalFileScanDaemon();
    this.isShuttingDown = false;
  }

  async start() {
    try {
      console.log(chalk.blue('🚀 Starting Medical File Scanning Daemon...'));
      
      // Initialize the daemon
      await this.daemon.initialize();
      
      console.log(chalk.green('✅ Medical File Scanning Daemon is running'));
      console.log(chalk.gray(`   • WebSocket server: ws://localhost:${this.daemon.options.websocket.port}`));
      console.log(chalk.gray(`   • Redis connection: ${this.daemon.options.redis.host}:${this.daemon.options.redis.port}`));
      console.log(chalk.gray(`   • ClamAV: ${this.daemon.options.clamav.enabled ? 'enabled' : 'disabled'}`));
      console.log(chalk.gray(`   • VirusTotal: ${this.daemon.options.virustotal.enabled ? 'enabled' : 'disabled'}`));
      console.log(chalk.gray(`   • YARA Rules: ${this.daemon.options.yara.enabled ? 'enabled' : 'disabled'}`));
      
      // Set up graceful shutdown
      this.setupGracefulShutdown();
      
      // Keep the process alive
      setInterval(() => {
        if (!this.isShuttingDown) {
          this.printStats();
        }
      }, 30000); // Print stats every 30 seconds
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to start daemon:'), error.message);
      process.exit(1);
    }
  }

  async stop() {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    console.log(chalk.yellow('\n🛑 Shutting down Medical File Scanning Daemon...'));
    
    try {
      await this.daemon.shutdown();
      console.log(chalk.green('✅ Daemon shutdown complete'));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Error during shutdown:'), error.message);
      process.exit(1);
    }
  }

  async restart() {
    console.log(chalk.yellow('🔄 Restarting Medical File Scanning Daemon...'));
    await this.stop();
    await this.start();
  }

  async status() {
    try {
      if (this.daemon.isInitialized) {
        const stats = this.daemon.scanStats;
        const queueStatus = await this.daemon.getQueueStatus();
        
        console.log(chalk.blue('\n📊 Medical File Scanning Daemon Status'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(`${chalk.cyan('Status:')} ${chalk.green('Running')}`);
        console.log(`${chalk.cyan('Total Scans:')} ${stats.totalScans}`);
        console.log(`${chalk.cyan('Clean Files:')} ${chalk.green(stats.cleanFiles)}`);
        console.log(`${chalk.cyan('Infected Files:')} ${chalk.red(stats.infectedFiles)}`);
        console.log(`${chalk.cyan('Suspicious Files:')} ${chalk.yellow(stats.suspiciousFiles)}`);
        console.log(`${chalk.cyan('Errors:')} ${chalk.red(stats.errors)}`);
        console.log(`${chalk.cyan('Avg Scan Time:')} ${stats.averageScanTime}ms`);
        console.log(chalk.gray('─'.repeat(50)));
        console.log(`${chalk.cyan('Queue - Waiting:')} ${queueStatus.waiting}`);
        console.log(`${chalk.cyan('Queue - Active:')} ${queueStatus.active}`);
        console.log(`${chalk.cyan('Queue - Completed:')} ${queueStatus.completed}`);
        console.log(`${chalk.cyan('Queue - Failed:')} ${queueStatus.failed}`);
        
      } else {
        console.log(chalk.red('❌ Daemon is not running'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error getting status:'), error.message);
    }
  }

  printStats() {
    if (this.daemon.isInitialized) {
      const stats = this.daemon.scanStats;
      console.log(chalk.gray(`📊 Stats: ${stats.totalScans} scans | ${stats.cleanFiles} clean | ${stats.infectedFiles} infected | ${stats.suspiciousFiles} suspicious`));
    }
  }

  setupGracefulShutdown() {
    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n⚠️ Received SIGINT, shutting down gracefully...'));
      this.stop();
    });

    // Handle SIGTERM
    process.on('SIGTERM', () => {
      console.log(chalk.yellow('\n⚠️ Received SIGTERM, shutting down gracefully...'));
      this.stop();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error(chalk.red('❌ Uncaught Exception:'), error);
      this.stop();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error(chalk.red('❌ Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
      this.stop();
    });
  }

  showHelp() {
    console.log(chalk.blue('\n🏥 Medical File Scanning Daemon'));
    console.log(chalk.gray('A comprehensive security scanning service for medical files\n'));
    
    console.log(chalk.yellow('Usage:'));
    console.log('  node scanDaemon.js [command]\n');
    
    console.log(chalk.yellow('Commands:'));
    console.log('  start     Start the scanning daemon (default)');
    console.log('  stop      Stop the scanning daemon');
    console.log('  restart   Restart the scanning daemon');
    console.log('  status    Show daemon status and statistics');
    console.log('  help      Show this help message\n');
    
    console.log(chalk.yellow('Environment Variables:'));
    console.log('  REDIS_HOST            Redis server host (default: localhost)');
    console.log('  REDIS_PORT            Redis server port (default: 6379)');
    console.log('  REDIS_PASSWORD        Redis password');
    console.log('  CLAMAV_HOST           ClamAV daemon host (default: localhost)');
    console.log('  CLAMAV_PORT           ClamAV daemon port (default: 3310)');
    console.log('  VIRUSTOTAL_API_KEY    VirusTotal API key (for Gold tier scanning)');
    console.log('  SCAN_DAEMON_WS_PORT   WebSocket server port (default: 8081)\n');
    
    console.log(chalk.yellow('Features:'));
    console.log('  • ClamAV antivirus scanning');
    console.log('  • YARA rule-based detection');
    console.log('  • VirusTotal API integration (Gold tier)');
    console.log('  • Queue-based processing with Redis');
    console.log('  • Real-time WebSocket notifications');
    console.log('  • Tiered scanning based on subscription levels');
    console.log('  • HIPAA-compliant audit logging\n');
  }
}

// Main execution
async function main() {
  const runner = new ScanDaemonRunner();
  
  switch (command) {
    case 'start':
      await runner.start();
      break;
      
    case 'stop':
      await runner.stop();
      break;
      
    case 'restart':
      await runner.restart();
      break;
      
    case 'status':
      await runner.status();
      process.exit(0);
      break;
      
    case 'help':
    case '--help':
    case '-h':
      runner.showHelp();
      process.exit(0);
      break;
      
    default:
      console.log(chalk.red(`❌ Unknown command: ${command}`));
      runner.showHelp();
      process.exit(1);
  }
}

// Check if this file is being run directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = ScanDaemonRunner;