import { Client, ConnectConfig } from 'ssh2';
import * as openpgp from 'openpgp';
import fs from 'fs';
import path from 'path';
import { db, JellyfinConfig } from './db.js';

export interface SftpDiagnosticLog {
  id: string;
  event: string;
  status: 'info' | 'success' | 'warning' | 'error';
  filename?: string;
  transactionRef?: string;
  message: string;
  createdAt: string;
}

export interface ParsedSquadTransaction {
  transactionRef: string;
  status: string;
  amount?: number;
  currency?: string;
  paidAt?: string;
  rawRow: Record<string, string>;
}

export class SquadSftpService {
  private static isSyncing = false;

  // Sanitized diagnostic logger that protects credentials
  public static async log(
    event: string,
    status: 'info' | 'success' | 'warning' | 'error',
    message: string,
    meta?: { filename?: string; transactionRef?: string }
  ): Promise<void> {
    // Sanitize any accidentally included keys/passwords/card numbers in message
    let sanitizedMessage = message
      .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/gi, '[REDACTED_PRIVATE_KEY]')
      .replace(/(?:password|secret|passphrase|apiKey|squadSecretKey)["':\s=]+([^"',;\s]+)/gi, '$1=[REDACTED]')
      .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[REDACTED_CARD_NUMBER]');

    const logEntry: SftpDiagnosticLog = {
      id: 'sftp_log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      event,
      status,
      filename: meta?.filename,
      transactionRef: meta?.transactionRef,
      message: sanitizedMessage,
      createdAt: new Date().toISOString()
    };

    console.log(`[SQUAD SFTP] [${event.toUpperCase()}] [${status.toUpperCase()}]: ${sanitizedMessage}`);

    try {
      await db.createSftpLog(logEntry);
    } catch (e: any) {
      console.warn('[SQUAD SFTP] Failed to save diagnostic log to DB:', e.message);
    }
  }

  /**
   * Test SFTP server connectivity without downloading files
   */
  public static async testConnection(customConfig?: Partial<JellyfinConfig>): Promise<{ success: boolean; message: string; details?: any }> {
    const config = customConfig || (await db.getConfig());
    const host = (config?.squadSftpHost || process.env.SQUAD_SFTP_HOST || '').trim();
    const port = Number(config?.squadSftpPort || process.env.SQUAD_SFTP_PORT || 22);
    const username = (config?.squadSftpUsername || process.env.SQUAD_SFTP_USERNAME || '').trim();
    const password = (config?.squadSftpPassword || process.env.SQUAD_SFTP_PASSWORD || '').trim();
    const privateKey = (config?.squadSftpPrivateKey || process.env.SQUAD_SFTP_PRIVATE_KEY || '').trim();
    const remoteDir = (config?.squadSftpRemoteDir || '/').trim();

    if (!host || !username) {
      const msg = 'SFTP Host and Username must be configured';
      await this.log('connection', 'error', msg);
      return { success: false, message: msg };
    }

    await this.log('connection', 'info', `Initiating test SFTP connection to ${host}:${port} as ${username}...`);

    return new Promise((resolve) => {
      const conn = new Client();
      let isResolved = false;

      const finish = (result: { success: boolean; message: string; details?: any }) => {
        if (!isResolved) {
          isResolved = true;
          try { conn.end(); } catch (e) {}
          resolve(result);
        }
      };

      const timer = setTimeout(() => {
        const msg = `Connection to SFTP host ${host}:${port} timed out after 15s`;
        this.log('connection', 'error', msg);
        finish({ success: false, message: msg });
      }, 15000);

      conn.on('ready', () => {
        clearTimeout(timer);
        conn.sftp((err, sftp) => {
          if (err) {
            const msg = `SFTP subsystem handshake failed on ${host}: ${err.message}`;
            this.log('connection', 'error', msg);
            return finish({ success: false, message: msg });
          }

          sftp.readdir(remoteDir, (dirErr, list) => {
            if (dirErr) {
              const msg = `Connected successfully, but remote directory '${remoteDir}' is inaccessible: ${dirErr.message}`;
              this.log('connection', 'warning', msg);
              return finish({ 
                success: true, 
                message: `SFTP Connection successful, but remote directory '${remoteDir}' returned error: ${dirErr.message}`,
                details: { host, port, username, remoteDir, fileCount: 0 }
              });
            }

            const fileNames = (list || []).map(item => item.filename);
            const msg = `SFTP Connection established successfully. Remote directory '${remoteDir}' contains ${fileNames.length} items.`;
            this.log('connection', 'success', msg);
            finish({
              success: true,
              message: msg,
              details: {
                host,
                port,
                username,
                remoteDir,
                files: fileNames.slice(0, 10),
                totalFiles: fileNames.length
              }
            });
          });
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timer);
        const msg = `SFTP Connection error to ${host}:${port}: ${err.message}`;
        this.log('connection', 'error', msg);
        finish({ success: false, message: msg });
      });

      const connectOpts: ConnectConfig = {
        host,
        port,
        username,
        readyTimeout: 12000
      };

      if (privateKey) {
        connectOpts.privateKey = privateKey;
      }
      if (password) {
        connectOpts.password = password;
      }

      try {
        conn.connect(connectOpts);
      } catch (err: any) {
        clearTimeout(timer);
        const msg = `SFTP initialization failed: ${err.message}`;
        this.log('connection', 'error', msg);
        finish({ success: false, message: msg });
      }
    });
  }

  /**
   * Decrypt a GPG or plain text buffer/file using configured OpenPGP keys
   */
  public static async decryptFile(
    fileBuffer: Buffer,
    filename: string,
    config: JellyfinConfig | null
  ): Promise<{ success: boolean; content: string; error?: string }> {
    const isGpg = filename.toLowerCase().endsWith('.gpg') || filename.toLowerCase().endsWith('.pgp');
    
    if (!isGpg) {
      // Plain text CSV file
      await this.log('file_decrypted', 'info', `File '${filename}' is unencrypted plaintext. Proceeding directly to parsing.`, { filename });
      return { success: true, content: fileBuffer.toString('utf8') };
    }

    const gpgPrivateKey = (config?.squadSftpGpgPrivateKey || process.env.SQUAD_SFTP_GPG_PRIVATE_KEY || '').trim();
    const gpgPassphrase = (config?.squadSftpGpgPassphrase || process.env.SQUAD_SFTP_GPG_PASSPHRASE || '').trim();

    if (!gpgPrivateKey && !gpgPassphrase) {
      const msg = `File '${filename}' is GPG-encrypted (.gpg), but no GPG private key or passphrase is configured in Admin Settings.`;
      await this.log('file_decrypted', 'error', msg, { filename });
      return { success: false, content: '', error: msg };
    }

    try {
      await this.log('file_decrypted', 'info', `Decrypting encrypted payload '${filename}' using configured OpenPGP key...`, { filename });
      
      let message;
      // Detect whether it is binary OpenPGP message or armored
      try {
        message = await openpgp.readMessage({ binaryMessage: new Uint8Array(fileBuffer) });
      } catch (armoredErr) {
        message = await openpgp.readMessage({ armoredMessage: fileBuffer.toString('utf8') });
      }

      let decryptionOptions: any = { message };

      if (gpgPrivateKey) {
        let privateKeyObj = await openpgp.readPrivateKey({ armoredKey: gpgPrivateKey });
        if (gpgPassphrase) {
          privateKeyObj = await openpgp.decryptKey({ privateKey: privateKeyObj, passphrase: gpgPassphrase });
        }
        decryptionOptions.decryptionKeys = privateKeyObj;
      } else if (gpgPassphrase) {
        decryptionOptions.passwords = [gpgPassphrase];
      }

      const decrypted = await openpgp.decrypt(decryptionOptions);
      const plainText = typeof decrypted.data === 'string' ? decrypted.data : Buffer.from(decrypted.data as Uint8Array).toString('utf8');

      await this.log('file_decrypted', 'success', `File '${filename}' decrypted successfully (${plainText.length} characters).`, { filename });
      return { success: true, content: plainText };
    } catch (decryptErr: any) {
      const msg = `GPG Decryption failed for '${filename}': ${decryptErr.message}`;
      await this.log('file_decrypted', 'error', msg, { filename });
      return { success: false, content: '', error: msg };
    }
  }

  /**
   * Parse CSV content into structured Squad transaction records
   */
  public static parseCsv(csvContent: string, filename: string): ParsedSquadTransaction[] {
    const lines = csvContent
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length <= 1) {
      return [];
    }

    // Determine delimiter (comma, semicolon, tab)
    const headerLine = lines[0];
    let delimiter = ',';
    if (headerLine.includes('\t')) delimiter = '\t';
    else if (headerLine.includes(';') && !headerLine.includes(',')) delimiter = ';';

    const parseRow = (row: string): string[] => {
      const result: string[] = [];
      let inQuotes = false;
      let current = '';
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const headers = parseRow(headerLine).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));

    // Identify crucial header indexes
    const findHeaderIdx = (patterns: string[]): number => {
      return headers.findIndex(h => patterns.some(p => h.includes(p)));
    };

    const refIdx = findHeaderIdx(['trans_ref', 'transaction_ref', 'transaction_reference', 'reference', 'trxref', 'ref', 'merchant_ref', 'sq_ref']);
    const statusIdx = findHeaderIdx(['status', 'transaction_status', 'payment_status', 'trans_status', 'state']);
    const amountIdx = findHeaderIdx(['amount', 'transaction_amount', 'paid_amount', 'total_amount', 'kobo']);
    const currencyIdx = findHeaderIdx(['currency', 'trans_currency', 'curr']);
    const dateIdx = findHeaderIdx(['date', 'paid_at', 'timestamp', 'created_at', 'transaction_date']);

    const transactions: ParsedSquadTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseRow(lines[i]);
      if (cols.length < 1) continue;

      const rawRow: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rawRow[h] = cols[idx] || '';
      });

      // Extract transaction reference
      let txRef = refIdx !== -1 ? cols[refIdx] : '';
      if (!txRef) {
        // Search across any column for standard Squad reference patterns (e.g. SQD_..., CINJ_...)
        for (const col of cols) {
          if (col && (col.startsWith('SQD_') || col.startsWith('CINJ_') || col.startsWith('squad_') || col.length >= 10)) {
            txRef = col;
            break;
          }
        }
      }

      if (!txRef) continue;

      const status = statusIdx !== -1 ? cols[statusIdx] : 'success';
      const amountStr = amountIdx !== -1 ? cols[amountIdx] : '';
      const amount = amountStr ? parseFloat(amountStr.replace(/[^0-9.]/g, '')) : undefined;
      const currency = currencyIdx !== -1 ? cols[currencyIdx] : 'NGN';
      const paidAt = dateIdx !== -1 ? cols[dateIdx] : undefined;

      transactions.push({
        transactionRef: txRef.trim(),
        status: status.trim().toLowerCase(),
        amount,
        currency: currency.trim().toUpperCase(),
        paidAt,
        rawRow
      });
    }

    return transactions;
  }

  /**
   * Process a single notification file buffer/stream end-to-end
   */
  public static async processFileContent(
    fileBuffer: Buffer,
    filename: string,
    fulfillSquadPaymentFn: (ref: string, mandateId?: string) => Promise<any>
  ): Promise<{
    success: boolean;
    filename: string;
    totalRows: number;
    processedRefs: string[];
    alreadyProcessedRefs: string[];
    failedRefs: string[];
    error?: string;
  }> {
    const config = await db.getConfig();
    const resultSummary = {
      success: true,
      filename,
      totalRows: 0,
      processedRefs: [] as string[],
      alreadyProcessedRefs: [] as string[],
      failedRefs: [] as string[],
      error: undefined as string | undefined
    };

    await this.log('file_received', 'info', `Received notification file '${filename}' (${fileBuffer.length} bytes)`, { filename });

    // 1. Decrypt file if GPG
    const decryptResult = await this.decryptFile(fileBuffer, filename, config);
    if (!decryptResult.success) {
      resultSummary.success = false;
      resultSummary.error = decryptResult.error;
      await db.updateSftpStatus({
        lastSync: new Date().toISOString(),
        lastFile: filename,
        lastError: decryptResult.error,
        lastStatus: 'Error'
      });
      return resultSummary;
    }

    // 2. Parse CSV
    const transactions = this.parseCsv(decryptResult.content, filename);
    resultSummary.totalRows = transactions.length;

    await this.log('file_parsed', 'info', `Parsed file '${filename}': extracted ${transactions.length} candidate transaction records`, { filename });

    if (transactions.length === 0) {
      await this.log('file_parsed', 'warning', `File '${filename}' parsed but no valid transaction rows found.`, { filename });
      await db.updateSftpStatus({
        lastSync: new Date().toISOString(),
        lastFile: filename,
        lastStatus: 'Success'
      });
      return resultSummary;
    }

    // 3. Process each transaction record
    for (const tx of transactions) {
      const ref = tx.transactionRef;
      await this.log('tx_extracted', 'info', `Transaction reference extracted: '${ref}' (CSV status: ${tx.status}, amount: ${tx.amount || 'N/A'})`, { filename, transactionRef: ref });

      // Check if transaction status is successful in CSV
      const isSuccessfulInCsv = ['success', 'successful', 'approved', 'completed', 'paid', '1', 'true'].includes(tx.status);
      if (!isSuccessfulInCsv && tx.status !== '') {
        await this.log('tx_lookup', 'info', `Skipping transaction '${ref}' because CSV status is '${tx.status}' (not successful)`, { filename, transactionRef: ref });
        continue;
      }

      // Check idempotency: already processed?
      const alreadyProcessed = await db.isTransactionProcessed(ref);
      if (alreadyProcessed) {
        await this.log('already_processed', 'info', `Transaction '${ref}' was already processed via Webhook/earlier sync. Idempotency preserved; no duplicate renewal added.`, { filename, transactionRef: ref });
        resultSummary.alreadyProcessedRefs.push(ref);
        continue;
      }

      // Authoritative lookup: Find pending payment record matching the reference
      const pendingRecord = await db.getPendingPayment(ref);
      let targetUser = undefined;

      if (pendingRecord?.userId) {
        targetUser = await db.getUserById(pendingRecord.userId);
      } else {
        // Check users table directly by stored transactionRef
        targetUser = await db.getUserByTransactionRef(ref);
      }

      // STRICT REQUIREMENT: NEVER identify CINJELLY user by email, first name or last name
      if (!targetUser) {
        const msg = `Transaction reference '${ref}' extracted from SFTP file does not match any stored CINJELLY payment record. Skipping without associating by email/name.`;
        await this.log('tx_lookup', 'warning', msg, { filename, transactionRef: ref });
        resultSummary.failedRefs.push(ref);
        continue;
      }

      await this.log('tx_lookup', 'info', `Located CINJELLY user '${targetUser.username}' (${targetUser.id}) for reference '${ref}'`, { filename, transactionRef: ref });

      // Mandatory Server-Side Verification with Squad Verify Transaction API
      const squadSecretKey = (config?.squadSecretKey || process.env.SQUAD_SECRET_KEY || '').trim();
      const squadMode = config?.squadMode || 'live';
      const squadBaseUrl = squadMode === 'sandbox' ? 'https://sandbox-api-d.squadco.com' : 'https://api-d.squadco.com';

      if (!squadSecretKey) {
        const msg = `Squad Secret Key is not configured. Cannot perform mandatory server-side verification for '${ref}'.`;
        await this.log('verification', 'error', msg, { filename, transactionRef: ref });
        resultSummary.failedRefs.push(ref);
        continue;
      }

      let verifyJson: any = null;
      try {
        const verifyRes = await fetch(`${squadBaseUrl}/transaction/verify/${encodeURIComponent(ref)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${squadSecretKey}`,
            'Content-Type': 'application/json'
          }
        });

        verifyJson = await verifyRes.json().catch(() => ({}));
      } catch (netErr: any) {
        const msg = `Network error calling Squad Verify API for '${ref}': ${netErr.message}`;
        await this.log('verification', 'error', msg, { filename, transactionRef: ref });
        resultSummary.failedRefs.push(ref);
        continue;
      }

      const vData = verifyJson?.data || verifyJson;
      const transStatus = String(vData?.transaction_status || verifyJson?.transaction_status || '').toLowerCase();
      const currency = (vData?.currency || vData?.transaction_currency || 'NGN').toUpperCase();
      const paidKobo = Number(vData?.transaction_amount || vData?.amount || 0);

      const expectedAmountNaira = config?.subscriptionAmount ? Number(config.subscriptionAmount) : 600.00;
      const expectedKobo = Math.round(expectedAmountNaira * 100);

      if (transStatus !== 'success' && transStatus !== 'successful') {
        const msg = `Squad API verification failed for '${ref}': Squad returned status '${transStatus || 'unknown'}'`;
        await this.log('verification', 'error', msg, { filename, transactionRef: ref });
        resultSummary.failedRefs.push(ref);
        continue;
      }

      if (currency !== 'NGN') {
        const msg = `Squad API verification failed for '${ref}': Currency is '${currency}', expected 'NGN'`;
        await this.log('verification', 'error', msg, { filename, transactionRef: ref });
        resultSummary.failedRefs.push(ref);
        continue;
      }

      if (paidKobo < expectedKobo) {
        const msg = `Squad API verification failed for '${ref}': Paid ${paidKobo} kobo is less than expected ${expectedKobo} kobo`;
        await this.log('verification', 'error', msg, { filename, transactionRef: ref });
        resultSummary.failedRefs.push(ref);
        continue;
      }

      await this.log('verification', 'success', `Squad Verify Transaction API confirmed reference '${ref}': Status=SUCCESS, Currency=NGN, Amount=₦${(paidKobo/100).toFixed(2)}`, { filename, transactionRef: ref });

      // Call Centralized Idempotent Payment Fulfillment Function
      const fulfillRes = await fulfillSquadPaymentFn(ref);

      if (fulfillRes.success) {
        await this.log('fulfillment', 'success', `SFTP Fallback fulfillment successful for ref '${ref}'. Subscription extended by 30 days until ${fulfillRes.subscriptionExpiryDate || 'next period'}.`, { filename, transactionRef: ref });
        resultSummary.processedRefs.push(ref);

        await db.updateSftpStatus({
          lastSync: new Date().toISOString(),
          lastFile: filename,
          lastTxRef: ref,
          lastStatus: 'Success',
          lastError: ''
        });
      } else {
        await this.log('fulfillment', 'error', `SFTP Fallback fulfillment failed for ref '${ref}': ${fulfillRes.error}`, { filename, transactionRef: ref });
        resultSummary.failedRefs.push(ref);
      }
    }

    await db.updateSftpStatus({
      lastSync: new Date().toISOString(),
      lastFile: filename,
      lastStatus: resultSummary.failedRefs.length > 0 ? 'Warning' : 'Success'
    });

    return resultSummary;
  }

  /**
   * Run full SFTP synchronization routine: connect, list remote files, download new files, and process them
   */
  public static async runSync(fulfillSquadPaymentFn: (ref: string, mandateId?: string) => Promise<any>): Promise<{
    success: boolean;
    message: string;
    filesFound: number;
    filesProcessed: number;
    details?: any;
  }> {
    if (this.isSyncing) {
      return { success: false, message: 'SFTP synchronization is already in progress', filesFound: 0, filesProcessed: 0 };
    }

    this.isSyncing = true;
    const config = await db.getConfig();

    const host = (config?.squadSftpHost || process.env.SQUAD_SFTP_HOST || '').trim();
    const port = Number(config?.squadSftpPort || process.env.SQUAD_SFTP_PORT || 22);
    const username = (config?.squadSftpUsername || process.env.SQUAD_SFTP_USERNAME || '').trim();
    const password = (config?.squadSftpPassword || process.env.SQUAD_SFTP_PASSWORD || '').trim();
    const privateKey = (config?.squadSftpPrivateKey || process.env.SQUAD_SFTP_PRIVATE_KEY || '').trim();
    const remoteDir = (config?.squadSftpRemoteDir || '/notifications').trim();
    const processingDir = (config?.squadSftpProcessingDir || './storage/sftp').trim();

    // Ensure local processing directory exists
    try {
      if (!fs.existsSync(processingDir)) {
        fs.mkdirSync(processingDir, { recursive: true });
      }
    } catch (e) {}

    await db.updateSftpStatus({
      lastSync: new Date().toISOString(),
      lastStatus: 'Syncing'
    });

    // If no remote host configured, check local processing directory for fallback files
    if (!host || !username) {
      await this.log('connection', 'info', `No remote SFTP host configured. Scanning local processing directory '${processingDir}' for notification files...`);
      
      let localFiles: string[] = [];
      try {
        if (fs.existsSync(processingDir)) {
          localFiles = fs.readdirSync(processingDir).filter(f => 
            f.endsWith('.csv') || f.endsWith('.csv.gpg') || f.endsWith('.gpg') || f.endsWith('.txt')
          );
        }
      } catch (readErr: any) {
        await this.log('connection', 'error', `Failed to read local directory '${processingDir}': ${readErr.message}`);
      }

      if (localFiles.length === 0) {
        this.isSyncing = false;
        const msg = `SFTP fallback scan completed: No pending files found in local directory '${processingDir}' and remote SFTP is not configured.`;
        await db.updateSftpStatus({ lastSync: new Date().toISOString(), lastStatus: 'Idle' });
        return { success: true, message: msg, filesFound: 0, filesProcessed: 0 };
      }

      let processedCount = 0;
      for (const localFile of localFiles) {
        const fullPath = path.join(processingDir, localFile);
        try {
          const buffer = fs.readFileSync(fullPath);
          await this.processFileContent(buffer, localFile, fulfillSquadPaymentFn);
          processedCount++;
        } catch (fileErr: any) {
          await this.log('error', 'error', `Failed to process local file '${localFile}': ${fileErr.message}`, { filename: localFile });
        }
      }

      this.isSyncing = false;
      return { success: true, message: `Processed ${processedCount} local SFTP fallback files`, filesFound: localFiles.length, filesProcessed: processedCount };
    }

    // Connect to remote SFTP
    await this.log('connection', 'info', `Connecting to remote SFTP server ${host}:${port} as ${username}...`);

    return new Promise((resolve) => {
      const conn = new Client();
      let isResolved = false;

      const finish = (result: { success: boolean; message: string; filesFound: number; filesProcessed: number; details?: any }) => {
        this.isSyncing = false;
        if (!isResolved) {
          isResolved = true;
          try { conn.end(); } catch (e) {}
          resolve(result);
        }
      };

      const timer = setTimeout(() => {
        const msg = `SFTP connection to ${host}:${port} timed out after 30s`;
        this.log('connection', 'error', msg);
        db.updateSftpStatus({ lastError: msg, lastStatus: 'Error' });
        finish({ success: false, message: msg, filesFound: 0, filesProcessed: 0 });
      }, 30000);

      conn.on('ready', () => {
        clearTimeout(timer);
        this.log('connection', 'success', `Connected to remote SFTP server ${host}:${port}`);

        conn.sftp(async (err, sftp) => {
          if (err) {
            const msg = `SFTP subsystem failed: ${err.message}`;
            await this.log('connection', 'error', msg);
            await db.updateSftpStatus({ lastError: msg, lastStatus: 'Error' });
            return finish({ success: false, message: msg, filesFound: 0, filesProcessed: 0 });
          }

          sftp.readdir(remoteDir, async (dirErr, list) => {
            if (dirErr) {
              const msg = `Failed to read remote directory '${remoteDir}': ${dirErr.message}`;
              await this.log('connection', 'error', msg);
              await db.updateSftpStatus({ lastError: msg, lastStatus: 'Error' });
              return finish({ success: false, message: msg, filesFound: 0, filesProcessed: 0 });
            }

            const candidateFiles = (list || []).filter(item => {
              const name = item.filename.toLowerCase();
              return !item.attrs.isDirectory() && (name.endsWith('.csv') || name.endsWith('.csv.gpg') || name.endsWith('.gpg') || name.endsWith('.txt'));
            });

            await this.log('connection', 'info', `Found ${candidateFiles.length} transaction notification files in remote '${remoteDir}'`);

            if (candidateFiles.length === 0) {
              await db.updateSftpStatus({
                lastSync: new Date().toISOString(),
                lastStatus: 'Success'
              });
              return finish({ success: true, message: 'SFTP check completed: No new notification files found.', filesFound: 0, filesProcessed: 0 });
            }

            let processedCount = 0;
            for (const fileItem of candidateFiles) {
              const remoteFilePath = path.posix.join(remoteDir, fileItem.filename);
              const localFilePath = path.join(processingDir, fileItem.filename);

              try {
                // Download file into memory buffer
                const fileBuffer = await new Promise<Buffer>((fileResolve, fileReject) => {
                  const chunks: Buffer[] = [];
                  const readStream = sftp.createReadStream(remoteFilePath);
                  readStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
                  readStream.on('end', () => fileResolve(Buffer.concat(chunks)));
                  readStream.on('error', (streamErr) => fileReject(streamErr));
                });

                // Also save local copy in processing directory
                try {
                  fs.writeFileSync(localFilePath, fileBuffer);
                } catch (saveErr) {}

                // Process the downloaded file content
                await this.processFileContent(fileBuffer, fileItem.filename, fulfillSquadPaymentFn);
                processedCount++;
              } catch (fileErr: any) {
                await this.log('error', 'error', `Failed to download or process remote file '${fileItem.filename}': ${fileErr.message}`, { filename: fileItem.filename });
              }
            }

            await db.updateSftpStatus({
              lastSync: new Date().toISOString(),
              lastStatus: 'Success'
            });

            finish({
              success: true,
              message: `SFTP Synchronization successful: Processed ${processedCount} notification files from remote '${remoteDir}'.`,
              filesFound: candidateFiles.length,
              filesProcessed: processedCount
            });
          });
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timer);
        const msg = `SFTP Connection error to ${host}:${port}: ${err.message}`;
        this.log('connection', 'error', msg);
        db.updateSftpStatus({ lastError: msg, lastStatus: 'Error' });
        finish({ success: false, message: msg, filesFound: 0, filesProcessed: 0 });
      });

      const connectOpts: ConnectConfig = {
        host,
        port,
        username,
        readyTimeout: 15000
      };

      if (privateKey) connectOpts.privateKey = privateKey;
      if (password) connectOpts.password = password;

      try {
        conn.connect(connectOpts);
      } catch (err: any) {
        clearTimeout(timer);
        const msg = `SFTP connection initialization failed: ${err.message}`;
        this.log('connection', 'error', msg);
        db.updateSftpStatus({ lastError: msg, lastStatus: 'Error' });
        finish({ success: false, message: msg, filesFound: 0, filesProcessed: 0 });
      }
    });
  }
}
