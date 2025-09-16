#!/usr/bin/env node
/**
 * FHIR-Blockchain CLI Commands
 *
 * Command-line interface for FHIR to blockchain bridge operations
 * Enables healthcare providers to manage FHIR data imports, blockchain storage,
 * and HEALTH token rewards through the command line.
 */

const chalk = require('chalk');
const axios = require('axios');
const Table = require('cli-table3');
const ora = require('ora');
const inquirer = require('inquirer');
const { getConfig, getServerUrl } = require('./config');

class FHIRBlockchainCLI {
  constructor() {
    this.config = getConfig();
    this.serverUrl = getServerUrl();
  }

  /**
   * Display FHIR-Blockchain bridge status
   */
  async status() {
    const spinner = ora('Checking FHIR-Blockchain bridge status...').start();

    try {
      const response = await axios.get(`${this.serverUrl}/api/fhir/blockchain/status`, {
        headers: this.getAuthHeaders()
      });

      spinner.stop();

      if (response.data.success) {
        const status = response.data.data;

        console.log(chalk.cyan.bold('\n🔗 FHIR-Blockchain Bridge Status\n'));

        // Service status
        console.log(chalk.green('✓ Service:'), status.service, `v${status.version}`);
        console.log(chalk.blue('📅 Last Check:'), new Date(status.timestamp).toLocaleString());

        // Blockchain connections
        console.log(chalk.yellow.bold('\n📡 Blockchain Connections:'));
        const connections = status.blockchainConnections;
        console.log(chalk.green('✓ Hyperledger Fabric:'), connections.hyperledger ? 'Connected' : chalk.red('Disconnected'));
        console.log(chalk.green('✓ Polygon Supernet:'), connections.polygon ? 'Connected' : chalk.red('Disconnected'));
        console.log(chalk.green('✓ Ethereum:'), connections.ethereum ? 'Connected' : chalk.red('Disconnected'));

        // Supported resources
        console.log(chalk.yellow.bold('\n📋 Supported FHIR Resources:'));
        status.supportedFHIRResources.forEach(resource => {
          console.log(chalk.gray(`  • ${resource}`));
        });

        // Performance metrics
        console.log(chalk.yellow.bold('\n📊 Performance Metrics:'));
        console.log(chalk.white('Average Import Time:'), status.performance.avgImportTime);
        console.log(chalk.white('Max Concurrent Imports:'), status.performance.maxConcurrentImports);
        console.log(chalk.white('Daily Token Rewards:'), status.performance.dailyTokenRewards);
        console.log(chalk.white('Data Integrity Score:'), status.performance.dataIntegrityScore);

      } else {
        console.log(chalk.red('✗ Failed to get bridge status:', response.data.error));
      }

    } catch (error) {
      spinner.stop();
      console.error(chalk.red('✗ Error checking bridge status:'), error.response?.data?.error || error.message);
    }
  }

  /**
   * List connected hospitals and FHIR endpoints
   */
  async listHospitals() {
    const spinner = ora('Loading connected hospitals...').start();

    try {
      const response = await axios.get(`${this.serverUrl}/api/fhir/hospitals`, {
        headers: this.getAuthHeaders()
      });

      spinner.stop();

      if (response.data.success && response.data.data.length > 0) {
        const hospitals = response.data.data;

        console.log(chalk.cyan.bold(`\n🏥 Connected Hospitals (${hospitals.length})\n`));

        const table = new Table({
          head: ['ID', 'Name', 'FHIR Version', 'Status', 'Capabilities', 'Last Sync'],
          colWidths: [10, 25, 12, 12, 20, 20]
        });

        hospitals.forEach(hospital => {
          table.push([
            chalk.cyan(hospital.id.substring(0, 8)),
            hospital.name,
            hospital.fhirVersion,
            hospital.connected ? chalk.green('Connected') : chalk.red('Offline'),
            hospital.capabilities.join(', '),
            hospital.lastSync ? new Date(hospital.lastSync).toLocaleDateString() : 'Never'
          ]);
        });

        console.log(table.toString());

        console.log(chalk.gray('\nUse "diseasezone fhir import --hospital-id <id>" to import data'));

      } else {
        console.log(chalk.yellow('📭 No hospitals connected yet'));
        console.log(chalk.gray('Use "diseasezone fhir connect" to add hospitals'));
      }

    } catch (error) {
      spinner.stop();
      console.error(chalk.red('✗ Error loading hospitals:'), error.response?.data?.error || error.message);
    }
  }

  /**
   * Connect to a new FHIR-enabled hospital
   */
  async connectHospital() {
    console.log(chalk.cyan.bold('\n🔗 Connect FHIR-Enabled Hospital\n'));

    const questions = [
      {
        type: 'input',
        name: 'name',
        message: 'Hospital name:',
        validate: input => input.length > 0
      },
      {
        type: 'input',
        name: 'fhirEndpoint',
        message: 'FHIR base URL:',
        validate: input => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'list',
        name: 'authType',
        message: 'Authentication type:',
        choices: [
          { name: 'SMART on FHIR (OAuth2)', value: 'smart' },
          { name: 'API Key', value: 'api_key' },
          { name: 'Client Credentials', value: 'client_credentials' }
        ]
      },
      {
        type: 'input',
        name: 'clientId',
        message: 'Client ID:',
        when: answers => answers.authType === 'smart' || answers.authType === 'client_credentials'
      },
      {
        type: 'password',
        name: 'clientSecret',
        message: 'Client Secret:',
        when: answers => answers.authType === 'smart' || answers.authType === 'client_credentials'
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'API Key:',
        when: answers => answers.authType === 'api_key'
      }
    ];

    const answers = await inquirer.prompt(questions);

    const spinner = ora('Connecting to hospital FHIR endpoint...').start();

    try {
      const connectionData = {
        name: answers.name,
        fhirEndpoint: answers.fhirEndpoint,
        authType: answers.authType,
        credentials: {
          clientId: answers.clientId,
          clientSecret: answers.clientSecret,
          apiKey: answers.apiKey
        }
      };

      const response = await axios.post(`${this.serverUrl}/api/fhir/hospitals/connect`, connectionData, {
        headers: this.getAuthHeaders()
      });

      spinner.stop();

      if (response.data.success) {
        const hospital = response.data.data;
        console.log(chalk.green('\n✓ Hospital connected successfully!'));
        console.log(chalk.white('Hospital ID:'), chalk.cyan(hospital.id));
        console.log(chalk.white('FHIR Version:'), hospital.fhirVersion);
        console.log(chalk.white('Capabilities:'), hospital.capabilities.join(', '));
        console.log(chalk.gray('\nYou can now import FHIR data from this hospital.'));
      } else {
        console.log(chalk.red('✗ Failed to connect hospital:'), response.data.error);
      }

    } catch (error) {
      spinner.stop();
      console.error(chalk.red('✗ Connection failed:'), error.response?.data?.error || error.message);
    }
  }

  /**
   * Import FHIR data to blockchain
   */
  async importData(options = {}) {
    console.log(chalk.cyan.bold('\n📥 Import FHIR Data to Blockchain\n'));

    let hospitalId = options.hospitalId;
    let patientId = options.patientId;
    let walletAddress = options.walletAddress;

    // Get hospital ID if not provided
    if (!hospitalId) {
      const hospitalsResponse = await axios.get(`${this.serverUrl}/api/fhir/hospitals`, {
        headers: this.getAuthHeaders()
      });

      if (!hospitalsResponse.data.success || hospitalsResponse.data.data.length === 0) {
        console.log(chalk.red('✗ No hospitals connected. Use "diseasezone fhir connect" first.'));
        return;
      }

      const hospitalChoices = hospitalsResponse.data.data.map(h => ({
        name: `${h.name} (${h.fhirVersion})`,
        value: h.id
      }));

      const { selectedHospital } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedHospital',
        message: 'Select hospital:',
        choices: hospitalChoices
      }]);

      hospitalId = selectedHospital;
    }

    // Get patient ID if not provided
    if (!patientId) {
      const { enteredPatientId } = await inquirer.prompt([{
        type: 'input',
        name: 'enteredPatientId',
        message: 'Patient ID in hospital system:',
        validate: input => input.length > 0
      }]);
      patientId = enteredPatientId;
    }

    // Get wallet address if not provided
    if (!walletAddress) {
      const { enteredWallet } = await inquirer.prompt([{
        type: 'input',
        name: 'enteredWallet',
        message: 'Patient wallet address for HEALTH token rewards:',
        validate: input => {
          if (!input.startsWith('0x') || input.length !== 42) {
            return 'Please enter a valid Ethereum address';
          }
          return true;
        }
      }]);
      walletAddress = enteredWallet;
    }

    // Select resource types to import
    const { resourceTypes } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'resourceTypes',
      message: 'Select FHIR resources to import:',
      choices: [
        { name: 'Patient (Demographics)', value: 'Patient', checked: true },
        { name: 'Observation (Lab Results, Vitals)', value: 'Observation', checked: true },
        { name: 'Condition (Diagnoses)', value: 'Condition', checked: true },
        { name: 'Immunization (Vaccinations)', value: 'Immunization', checked: true },
        { name: 'DiagnosticReport (Test Results)', value: 'DiagnosticReport', checked: false }
      ],
      validate: answer => answer.length > 0 || 'Please select at least one resource type'
    }]);

    // Configure consent levels
    const { consentLevels } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'consentLevels',
      message: 'Patient consent for data usage:',
      choices: [
        { name: 'Allow medical research (anonymized)', value: 'allowResearch', checked: true },
        { name: 'Allow research marketplace (anonymized)', value: 'allowResearchMarketplace', checked: true },
        { name: 'Allow public health surveillance', value: 'allowSurveillance', checked: true },
        { name: 'Allow cross-institutional sharing', value: 'allowSharing', checked: false }
      ]
    }]);

    const consentObj = {};
    consentLevels.forEach(consent => consentObj[consent] = true);

    const spinner = ora('Importing FHIR data to blockchain...').start();

    try {
      const importData = {
        hospitalId,
        patientId,
        resourceTypes,
        consentLevels: consentObj,
        walletAddress
      };

      const response = await axios.post(`${this.serverUrl}/api/fhir/blockchain/import`, importData, {
        headers: this.getAuthHeaders()
      });

      spinner.stop();

      if (response.data.success) {
        const results = response.data.data;

        console.log(chalk.green('\n✓ FHIR data imported successfully!\n'));

        console.log(chalk.white('Session ID:'), chalk.cyan(results.sessionId));
        console.log(chalk.white('Resources Imported:'), chalk.green(results.successful.length));
        console.log(chalk.white('HEALTH Token Rewards:'), chalk.yellow(`${results.tokenRewards} HEALTH`));

        if (results.failed.length > 0) {
          console.log(chalk.white('Failed Imports:'), chalk.red(results.failed.length));
        }

        // Show blockchain transactions
        console.log(chalk.yellow.bold('\n📋 Blockchain Transactions:'));
        if (results.blockchainTransactions.hyperledger.length > 0) {
          console.log(chalk.gray('Hyperledger Fabric:'), results.blockchainTransactions.hyperledger.length, 'transactions');
        }
        if (results.blockchainTransactions.polygon.length > 0) {
          console.log(chalk.gray('Polygon Supernet:'), results.blockchainTransactions.polygon.length, 'transactions');
        }
        if (results.blockchainTransactions.ethereum.length > 0) {
          console.log(chalk.gray('Ethereum:'), results.blockchainTransactions.ethereum.length, 'transactions');
        }

        console.log(chalk.gray('\nVerification Hash:'), results.verificationHash);

      } else {
        console.log(chalk.red('✗ Import failed:'), response.data.error);
      }

    } catch (error) {
      spinner.stop();
      console.error(chalk.red('✗ Import error:'), error.response?.data?.error || error.message);
    }
  }

  /**
   * View import history and blockchain transactions
   */
  async history(options = {}) {
    const spinner = ora('Loading FHIR import history...').start();

    try {
      const response = await axios.get(`${this.serverUrl}/api/fhir/blockchain/history`, {
        headers: this.getAuthHeaders(),
        params: {
          limit: options.limit || 10,
          hospitalId: options.hospitalId
        }
      });

      spinner.stop();

      if (response.data.success && response.data.data.length > 0) {
        const imports = response.data.data;

        console.log(chalk.cyan.bold(`\n📜 FHIR Import History (${imports.length} recent)\n`));

        const table = new Table({
          head: ['Session ID', 'Hospital', 'Resources', 'Rewards', 'Status', 'Date'],
          colWidths: [15, 20, 15, 12, 12, 18]
        });

        imports.forEach(imp => {
          table.push([
            chalk.cyan(imp.sessionId.substring(0, 12) + '...'),
            imp.hospitalName || 'Unknown',
            imp.resourceCount || 0,
            chalk.yellow(`${imp.tokenRewards || 0} HEALTH`),
            imp.status === 'completed' ? chalk.green('✓') : chalk.red('✗'),
            new Date(imp.timestamp).toLocaleDateString()
          ]);
        });

        console.log(table.toString());

      } else {
        console.log(chalk.yellow('📭 No import history found'));
      }

    } catch (error) {
      spinner.stop();
      console.error(chalk.red('✗ Error loading history:'), error.response?.data?.error || error.message);
    }
  }

  /**
   * Check HEALTH token balance from FHIR contributions
   */
  async tokenBalance(walletAddress) {
    const spinner = ora('Checking HEALTH token balance...').start();

    try {
      const response = await axios.get(`${this.serverUrl}/api/fhir/blockchain/tokens/${walletAddress}`, {
        headers: this.getAuthHeaders()
      });

      spinner.stop();

      if (response.data.success) {
        const balance = response.data.data;

        console.log(chalk.cyan.bold('\n💰 HEALTH Token Balance\n'));
        console.log(chalk.white('Wallet Address:'), chalk.cyan(walletAddress));
        console.log(chalk.white('Total Balance:'), chalk.yellow(`${balance.total} HEALTH`));
        console.log(chalk.white('From FHIR Contributions:'), chalk.green(`${balance.fromFHIR} HEALTH`));
        console.log(chalk.white('Last Reward:'), balance.lastReward ? new Date(balance.lastReward).toLocaleString() : 'None');

        if (balance.pendingRewards > 0) {
          console.log(chalk.white('Pending Rewards:'), chalk.yellow(`${balance.pendingRewards} HEALTH`));
        }

      } else {
        console.log(chalk.red('✗ Failed to get token balance:'), response.data.error);
      }

    } catch (error) {
      spinner.stop();
      console.error(chalk.red('✗ Error checking balance:'), error.response?.data?.error || error.message);
    }
  }

  /**
   * Sync FHIR data across blockchain layers
   */
  async sync(options = {}) {
    const spinner = ora('Synchronizing FHIR data across blockchain layers...').start();

    try {
      const response = await axios.post(`${this.serverUrl}/api/fhir/blockchain/sync`, {
        hospitalId: options.hospitalId,
        force: options.force || false,
        layers: options.layers || ['hyperledger', 'polygon', 'ethereum']
      }, {
        headers: this.getAuthHeaders()
      });

      spinner.stop();

      if (response.data.success) {
        const results = response.data.data;

        console.log(chalk.green('\n✓ FHIR blockchain sync completed!\n'));
        console.log(chalk.white('Records Synchronized:'), results.recordCount);
        console.log(chalk.white('Cross-chain Verifications:'), results.verificationCount);
        console.log(chalk.white('Data Integrity Score:'), chalk.green(`${results.integrityScore}%`));

      } else {
        console.log(chalk.red('✗ Sync failed:'), response.data.error);
      }

    } catch (error) {
      spinner.stop();
      console.error(chalk.red('✗ Sync error:'), error.response?.data?.error || error.message);
    }
  }

  getAuthHeaders() {
    const token = this.config.api_key || this.config.token;
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
}

// Export command functions
const fhirBlockchainCli = new FHIRBlockchainCLI();

module.exports = {
  status: () => fhirBlockchainCli.status(),
  listHospitals: () => fhirBlockchainCli.listHospitals(),
  connectHospital: () => fhirBlockchainCli.connectHospital(),
  importData: (options) => fhirBlockchainCli.importData(options),
  history: (options) => fhirBlockchainCli.history(options),
  tokenBalance: (walletAddress) => fhirBlockchainCli.tokenBalance(walletAddress),
  sync: (options) => fhirBlockchainCli.sync(options)
};