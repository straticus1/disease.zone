'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

class HealthRecordsContract extends Contract {

    // Initialize the ledger with default data
    async initLedger(ctx) {
        console.info('============= START : Initialize Health Records Ledger ===========');

        const healthRecords = [
            {
                recordId: 'RECORD001',
                patientId: 'encrypted-patient-id-001',
                hospitalId: 'HOSPITAL001',
                diseaseCategory: 'STI',
                diseaseCode: 'HIV',
                timestamp: new Date().toISOString(),
                dataHash: crypto.createHash('sha256').update('sample-data').digest('hex'),
                accessLevel: 'RESTRICTED',
                researchConsent: true
            }
        ];

        for (let i = 0; i < healthRecords.length; i++) {
            healthRecords[i].docType = 'healthRecord';
            await ctx.stub.putState('RECORD' + i, Buffer.from(JSON.stringify(healthRecords[i])));
            console.info('Added <--> ', healthRecords[i]);
        }
        console.info('============= END : Initialize Health Records Ledger ===========');
    }

    // Store encrypted health record
    async storeHealthRecord(ctx, recordId, patientId, hospitalId, diseaseCategory, diseaseCode, encryptedData, accessLevel) {
        console.info('============= START : Store Health Record ===========');

        // Verify caller has permission to store records
        const mspId = ctx.clientIdentity.getMSPID();
        if (mspId !== 'HospitalMSP' && mspId !== 'GovernmentMSP') {
            throw new Error('Only hospitals and government agencies can store health records');
        }

        const healthRecord = {
            docType: 'healthRecord',
            recordId,
            patientId: this.hashSensitiveData(patientId), // Hash for privacy
            hospitalId,
            diseaseCategory,
            diseaseCode,
            dataHash: crypto.createHash('sha256').update(encryptedData).digest('hex'),
            timestamp: new Date().toISOString(),
            accessLevel: accessLevel || 'RESTRICTED',
            researchConsent: false,
            submitterId: ctx.clientIdentity.getID(),
            mspId
        };

        await ctx.stub.putState(recordId, Buffer.from(JSON.stringify(healthRecord)));

        // Emit event for cross-chain integration
        await ctx.stub.setEvent('HealthRecordStored', Buffer.from(JSON.stringify({
            recordId,
            hospitalId,
            diseaseCategory,
            diseaseCode,
            timestamp: healthRecord.timestamp
        })));

        console.info('============= END : Store Health Record ===========');
        return JSON.stringify(healthRecord);
    }

    // Query health record by ID
    async queryHealthRecord(ctx, recordId) {
        const recordAsBytes = await ctx.stub.getState(recordId);
        if (!recordAsBytes || recordAsBytes.length === 0) {
            throw new Error(`Health record ${recordId} does not exist`);
        }

        const record = JSON.parse(recordAsBytes.toString());

        // Check access permissions
        if (!this.hasAccessPermission(ctx, record)) {
            throw new Error('Access denied: insufficient permissions for this health record');
        }

        return recordAsBytes.toString();
    }

    // Query records by hospital
    async queryRecordsByHospital(ctx, hospitalId) {
        const mspId = ctx.clientIdentity.getMSPID();

        // Only allow hospitals to query their own records, government can query all
        if (mspId === 'HospitalMSP' && ctx.clientIdentity.getAttributeValue('hospitalId') !== hospitalId) {
            throw new Error('Hospitals can only query their own records');
        }

        const queryString = {
            selector: {
                docType: 'healthRecord',
                hospitalId
            }
        };

        return await this.queryWithPagination(ctx, JSON.stringify(queryString), '', 50);
    }

    // Query anonymized records for research
    async queryAnonymizedRecords(ctx, diseaseCategory, startDate, endDate) {
        const mspId = ctx.clientIdentity.getMSPID();

        // Only research organizations can access anonymized data
        if (mspId !== 'ResearchMSP') {
            throw new Error('Only research organizations can access anonymized records');
        }

        const queryString = {
            selector: {
                docType: 'healthRecord',
                diseaseCategory,
                researchConsent: true,
                timestamp: {
                    "$gte": startDate,
                    "$lte": endDate
                }
            }
        };

        const results = await this.queryWithPagination(ctx, JSON.stringify(queryString), '', 100);

        // Remove sensitive fields for research
        const anonymizedResults = results.map(record => ({
            diseaseCategory: record.diseaseCategory,
            diseaseCode: record.diseaseCode,
            timestamp: record.timestamp,
            accessLevel: record.accessLevel,
            hospitalId: this.anonymizeHospitalId(record.hospitalId),
            recordId: this.anonymizeRecordId(record.recordId)
        }));

        return JSON.stringify(anonymizedResults);
    }

    // Update research consent
    async updateResearchConsent(ctx, recordId, consent) {
        const recordAsBytes = await ctx.stub.getState(recordId);
        if (!recordAsBytes || recordAsBytes.length === 0) {
            throw new Error(`Health record ${recordId} does not exist`);
        }

        const record = JSON.parse(recordAsBytes.toString());

        // Verify permission to update consent
        if (!this.canUpdateConsent(ctx, record)) {
            throw new Error('Access denied: cannot update research consent for this record');
        }

        record.researchConsent = consent;
        record.lastUpdated = new Date().toISOString();
        record.updatedBy = ctx.clientIdentity.getID();

        await ctx.stub.putState(recordId, Buffer.from(JSON.stringify(record)));

        // Emit event for consent change
        await ctx.stub.setEvent('ConsentUpdated', Buffer.from(JSON.stringify({
            recordId,
            consent,
            timestamp: record.lastUpdated
        })));

        return JSON.stringify(record);
    }

    // Create outbreak alert
    async createOutbreakAlert(ctx, alertId, diseaseCode, location, severity, affectedPopulation, detectionMethod) {
        const mspId = ctx.clientIdentity.getMSPID();

        // Only government and hospitals can create outbreak alerts
        if (mspId !== 'GovernmentMSP' && mspId !== 'HospitalMSP') {
            throw new Error('Only government agencies and hospitals can create outbreak alerts');
        }

        const alert = {
            docType: 'outbreakAlert',
            alertId,
            diseaseCode,
            location,
            severity,
            affectedPopulation: parseInt(affectedPopulation),
            detectionMethod,
            timestamp: new Date().toISOString(),
            status: 'ACTIVE',
            createdBy: ctx.clientIdentity.getID(),
            mspId
        };

        await ctx.stub.putState(alertId, Buffer.from(JSON.stringify(alert)));

        // Emit high-priority event for outbreak alert
        await ctx.stub.setEvent('OutbreakAlertCreated', Buffer.from(JSON.stringify(alert)));

        return JSON.stringify(alert);
    }

    // Verify data integrity
    async verifyDataIntegrity(ctx, recordId, dataHash) {
        const recordAsBytes = await ctx.stub.getState(recordId);
        if (!recordAsBytes || recordAsBytes.length === 0) {
            throw new Error(`Health record ${recordId} does not exist`);
        }

        const record = JSON.parse(recordAsBytes.toString());

        return {
            recordId,
            isValid: record.dataHash === dataHash,
            storedHash: record.dataHash,
            providedHash: dataHash,
            timestamp: record.timestamp
        };
    }

    // Get audit trail for a record
    async getAuditTrail(ctx, recordId) {
        const historyResults = [];
        const iterator = await ctx.stub.getHistoryForKey(recordId);

        while (true) {
            const result = await iterator.next();
            if (result.value && result.value.value.toString()) {
                const record = JSON.parse(result.value.value.toString('utf8'));
                historyResults.push({
                    txId: result.value.txId,
                    timestamp: result.value.timestamp,
                    isDelete: result.value.isDelete,
                    record: record
                });
            }
            if (result.done) {
                await iterator.close();
                break;
            }
        }

        return JSON.stringify(historyResults);
    }

    // Helper function to query with pagination
    async queryWithPagination(ctx, queryString, bookmark, pageSize) {
        const { iterator, metadata } = await ctx.stub.getQueryResultWithPagination(queryString, pageSize, bookmark);
        const results = [];

        while (true) {
            const result = await iterator.next();
            if (result.value && result.value.value.toString()) {
                results.push(JSON.parse(result.value.value.toString('utf8')));
            }
            if (result.done) {
                await iterator.close();
                break;
            }
        }

        return results;
    }

    // Helper function to check access permissions
    hasAccessPermission(ctx, record) {
        const mspId = ctx.clientIdentity.getMSPID();
        const userId = ctx.clientIdentity.getID();

        // Government has access to all records
        if (mspId === 'GovernmentMSP') {
            return true;
        }

        // Hospitals can access their own records
        if (mspId === 'HospitalMSP' && record.hospitalId === ctx.clientIdentity.getAttributeValue('hospitalId')) {
            return true;
        }

        // Research organizations can access records with research consent
        if (mspId === 'ResearchMSP' && record.researchConsent && record.accessLevel !== 'HIGHLY_RESTRICTED') {
            return true;
        }

        // Insurance companies can access specific records with proper authorization
        if (mspId === 'InsuranceMSP' && record.accessLevel === 'INSURANCE_ACCESSIBLE') {
            return true;
        }

        return false;
    }

    // Helper function to check consent update permission
    canUpdateConsent(ctx, record) {
        const mspId = ctx.clientIdentity.getMSPID();

        // Only the original hospital or government can update consent
        return (mspId === 'HospitalMSP' && record.hospitalId === ctx.clientIdentity.getAttributeValue('hospitalId')) ||
               mspId === 'GovernmentMSP';
    }

    // Helper function to hash sensitive data
    hashSensitiveData(data) {
        return crypto.createHash('sha256').update(data + process.env.PATIENT_ID_SALT || 'default-salt').digest('hex');
    }

    // Helper function to anonymize hospital ID for research
    anonymizeHospitalId(hospitalId) {
        const hash = crypto.createHash('md5').update(hospitalId).digest('hex');
        return 'ANON_HOSPITAL_' + hash.substring(0, 8);
    }

    // Helper function to anonymize record ID for research
    anonymizeRecordId(recordId) {
        const hash = crypto.createHash('md5').update(recordId).digest('hex');
        return 'ANON_RECORD_' + hash.substring(0, 8);
    }
}

module.exports = HealthRecordsContract;