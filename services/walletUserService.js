// Wallet integration methods for UserService
// These methods handle wallet data in the main application while operations happen on ledger subdomain

const { body, validationResult } = require('express-validator');

class WalletUserService {
  constructor(databaseService, authMiddleware) {
    this.db = databaseService;
    this.auth = authMiddleware;
  }

  // Validation rules for wallet operations
  getWalletConnectionValidation() {
    return [
      body('wallet_address')
        .matches(/^0x[a-fA-F0-9]{40}$/)
        .withMessage('Invalid Ethereum address format'),
      body('wallet_type')
        .optional()
        .isIn(['metamask', 'walletconnect', 'coinbase', 'generated', 'imported'])
        .withMessage('Invalid wallet type'),
      body('network')
        .optional()
        .isIn(['polygon', 'ethereum', 'mumbai', 'goerli'])
        .withMessage('Invalid network'),
      body('public_key')
        .optional()
        .isLength({ min: 64, max: 130 })
        .withMessage('Invalid public key format')
    ];
  }

  // Connect wallet to user account
  async connectWallet(userId, walletData, ip_address, user_agent) {
    try {
      // Check if wallet is already connected to another user
      const existingWallet = await this.db.get(
        'SELECT id, email FROM users WHERE wallet_address = ? AND id != ?',
        [walletData.wallet_address, userId]
      );

      if (existingWallet) {
        throw new Error('This wallet is already connected to another account');
      }

      // Update user with wallet information
      const updateData = {
        wallet_address: walletData.wallet_address,
        wallet_public_key: walletData.public_key || null,
        wallet_connected: true,
        wallet_network: walletData.network || 'polygon',
        wallet_type: walletData.wallet_type || 'unknown',
        last_balance_update: new Date().toISOString()
      };

      await this.db.run(`
        UPDATE users SET 
          wallet_address = ?,
          wallet_public_key = ?,
          wallet_connected = ?,
          wallet_network = ?,
          wallet_type = ?,
          last_balance_update = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        updateData.wallet_address,
        updateData.wallet_public_key,
        updateData.wallet_connected,
        updateData.wallet_network,
        updateData.wallet_type,
        updateData.last_balance_update,
        userId
      ]);

      // Log wallet connection
      await this.db.logAudit({
        user_id: userId,
        action: 'wallet_connected',
        resource_type: 'user_wallet',
        resource_id: walletData.wallet_address,
        details: {
          wallet_type: updateData.wallet_type,
          network: updateData.wallet_network
        },
        ip_address,
        user_agent
      });

      // Add to wallet audit log
      await this.db.run(`
        INSERT INTO wallet_audit_log (user_id, action, new_value, ip_address, user_agent, source)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [userId, 'connect', walletData.wallet_address, ip_address, user_agent, 'main_app']);

      return {
        success: true,
        message: 'Wallet connected successfully',
        wallet: {
          address: walletData.wallet_address,
          network: updateData.wallet_network,
          type: updateData.wallet_type,
          connected: true
        }
      };

    } catch (error) {
      console.error('Wallet connection error:', error);
      throw error;
    }
  }

  // Disconnect wallet from user account
  async disconnectWallet(userId, ip_address, user_agent) {
    try {
      const user = await this.db.getUserById(userId);
      if (!user || !user.wallet_connected) {
        throw new Error('No wallet connected to this account');
      }

      const oldWalletAddress = user.wallet_address;

      // Remove wallet information
      await this.db.run(`
        UPDATE users SET 
          wallet_address = NULL,
          wallet_public_key = NULL,
          wallet_connected = FALSE,
          wallet_type = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [userId]);

      // Log wallet disconnection
      await this.db.logAudit({
        user_id: userId,
        action: 'wallet_disconnected',
        resource_type: 'user_wallet',
        resource_id: oldWalletAddress,
        details: {},
        ip_address,
        user_agent
      });

      // Add to wallet audit log
      await this.db.run(`
        INSERT INTO wallet_audit_log (user_id, action, old_value, ip_address, user_agent, source)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [userId, 'disconnect', oldWalletAddress, ip_address, user_agent, 'main_app']);

      return {
        success: true,
        message: 'Wallet disconnected successfully'
      };

    } catch (error) {
      console.error('Wallet disconnection error:', error);
      throw error;
    }
  }

  // Update user's HEALTH credit balance (called from ledger subdomain)
  async updateHealthCreditBalance(userId, newBalance, source = 'ledger_sync') {
    try {
      const user = await this.db.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const oldBalance = user.health_credit_balance || 0;

      await this.db.run(`
        UPDATE users SET 
          health_credit_balance = ?,
          last_balance_update = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newBalance, userId]);

      // Log balance update
      await this.db.run(`
        INSERT INTO wallet_audit_log (user_id, action, old_value, new_value, source)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'balance_update', oldBalance.toString(), newBalance.toString(), source]);

      return {
        success: true,
        old_balance: oldBalance,
        new_balance: newBalance,
        difference: newBalance - oldBalance
      };

    } catch (error) {
      console.error('Balance update error:', error);
      throw error;
    }
  }

  // Get user's wallet information and balance
  async getWalletInfo(userId) {
    try {
      const user = await this.db.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get recent transactions
      const recentTransactions = await this.db.all(`
        SELECT transaction_type, amount, description, source_action, created_at, status
        FROM health_credit_transactions
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 10
      `, [userId]);

      return {
        success: true,
        wallet: {
          connected: user.wallet_connected || false,
          address: user.wallet_address,
          network: user.wallet_network,
          type: user.wallet_type,
          health_credit_balance: user.health_credit_balance || 0,
          last_balance_update: user.last_balance_update,
          recent_transactions: recentTransactions,
          show_publicly: user.show_wallet_publicly || false
        }
      };

    } catch (error) {
      console.error('Get wallet info error:', error);
      throw error;
    }
  }

  // Record a HEALTH credit transaction (synced from ledger)
  async recordHealthCreditTransaction(userId, transactionData) {
    try {
      const user = await this.db.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if transaction already exists
      const existing = await this.db.get(
        'SELECT id FROM health_credit_transactions WHERE transaction_hash = ?',
        [transactionData.transaction_hash]
      );

      if (existing) {
        throw new Error('Transaction already recorded');
      }

      // Insert transaction record
      const result = await this.db.run(`
        INSERT INTO health_credit_transactions (
          user_id, transaction_hash, transaction_type, amount, description,
          block_number, gas_used, gas_price, network, source_action,
          related_session_id, status, synced_from_ledger
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        transactionData.transaction_hash,
        transactionData.transaction_type,
        transactionData.amount,
        transactionData.description,
        transactionData.block_number,
        transactionData.gas_used,
        transactionData.gas_price,
        transactionData.network || 'polygon',
        transactionData.source_action,
        transactionData.related_session_id,
        transactionData.status || 'confirmed',
        true
      ]);

      // Update user's balance if this is a confirmed transaction
      if (transactionData.status === 'confirmed') {
        const balanceChange = transactionData.transaction_type === 'earn' ? 
          transactionData.amount : -transactionData.amount;
        
        const newBalance = (user.health_credit_balance || 0) + balanceChange;
        await this.updateHealthCreditBalance(userId, Math.max(0, newBalance), 'transaction_sync');
      }

      return {
        success: true,
        transaction_id: result.lastID,
        message: 'Transaction recorded successfully'
      };

    } catch (error) {
      console.error('Record transaction error:', error);
      throw error;
    }
  }

  // Get user's transaction history
  async getTransactionHistory(userId, limit = 50, offset = 0) {
    try {
      const transactions = await this.db.all(`
        SELECT 
          transaction_hash,
          transaction_type,
          amount,
          description,
          source_action,
          status,
          network,
          created_at
        FROM health_credit_transactions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `, [userId, limit, offset]);

      const totalCount = await this.db.get(
        'SELECT COUNT(*) as count FROM health_credit_transactions WHERE user_id = ?',
        [userId]
      );

      return {
        success: true,
        transactions,
        total_count: totalCount.count,
        limit,
        offset
      };

    } catch (error) {
      console.error('Get transaction history error:', error);
      throw error;
    }
  }

  // Update wallet privacy settings
  async updateWalletPrivacySettings(userId, settings) {
    try {
      await this.db.run(`
        UPDATE users SET 
          show_wallet_publicly = ?,
          allow_wallet_research_data = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        settings.show_wallet_publicly,
        settings.allow_wallet_research_data,
        userId
      ]);

      return {
        success: true,
        message: 'Wallet privacy settings updated successfully'
      };

    } catch (error) {
      console.error('Update wallet privacy error:', error);
      throw error;
    }
  }

  // Get wallet audit log (for security purposes)
  async getWalletAuditLog(userId, limit = 20) {
    try {
      const auditEntries = await this.db.all(`
        SELECT action, old_value, new_value, source, created_at
        FROM wallet_audit_log 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [userId, limit]);

      return {
        success: true,
        audit_entries: auditEntries
      };

    } catch (error) {
      console.error('Get wallet audit log error:', error);
      throw error;
    }
  }

  // Validation error handler
  handleValidationErrors(req) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
    }
  }
}

module.exports = WalletUserService;