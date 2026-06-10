// ─────────────────────────────────────────────────────────────
// Cloud Function: Sale Engine
// Region: europe-west1
//
// IDEMPOTENCY GUARANTEE:
//   Every operation is guarded by a flag checked inside the
//   same Firestore transaction that performs the write.
//   If the function retries, it reads the flag, sees it's
//   already true, and exits without side effects.
//
//   Sale creation guard: stockProcessed + balanceProcessed
//   Void guard:          voidProcessed
//
// Status flow:
//   client creates → status: 'pending'
//   CF processes   → status: 'confirmed'
//   CF fails       → status: 'failed' + failureReason
//   client voids   → isVoid: true (CF detects, reverses)
//   CF void done   → voidProcessed: true
// ─────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions/v2';
import {
  getFirestore,
  FieldValue,
  Transaction,
} from 'firebase-admin/firestore';

const db     = getFirestore();
const REGION = 'europe-west1';

// ── Invoice number generator ──────────────────────────────────
// Atomic — Firestore transaction on counter document.
// No two sales can ever get the same invoice number.
async function generateInvoiceNumber(
  companyId: string,
  txn:       Transaction
): Promise<string> {
  const counterRef = db.doc(
    `companies/${companyId}/settings/invoiceCounter`
  );
  const snap    = await txn.get(counterRef);
  const year    = new Date().getFullYear();
  const prefix  = snap.exists ? (snap.data()?.prefix  ?? 'INV') : 'INV';
  const padding = snap.exists ? (snap.data()?.padding ?? 4)     : 4;
  const storedYear = snap.exists ? (snap.data()?.year ?? year)  : year;
  // Reset counter if year has rolled over
  const next = (storedYear === year && snap.exists)
    ? (snap.data()?.next ?? 1) : 1;

  txn.set(counterRef, { prefix, year, next: next + 1, padding }, { merge: true });
  return `${prefix}-${year}-${String(next).padStart(padding, '0')}`;
}

// ── Receipt number generator ──────────────────────────────────
async function generateReceiptNumber(
  companyId: string,
  txn:       Transaction
): Promise<string> {
  const counterRef = db.doc(
    `companies/${companyId}/settings/receiptCounter`
  );
  const snap    = await txn.get(counterRef);
  const year    = new Date().getFullYear();
  const prefix  = snap.exists ? (snap.data()?.prefix  ?? 'RCT') : 'RCT';
  const padding = snap.exists ? (snap.data()?.padding ?? 4)     : 4;
  const storedYear = snap.exists ? (snap.data()?.year ?? year)  : year;
  const next = (storedYear === year && snap.exists)
    ? (snap.data()?.next ?? 1) : 1;

  txn.set(counterRef, { prefix, year, next: next + 1, padding }, { merge: true });
  return `${prefix}-${year}-${String(next).padStart(padding, '0')}`;
}

// ── Main trigger ──────────────────────────────────────────────
export const onSaleWrite = functions.firestore.onDocumentWritten(
  { document: 'companies/{companyId}/sales/{saleId}', region: REGION },
  async (event) => {
    const companyId = event.params.companyId;
    const saleId    = event.params.saleId;
    const before    = event.data?.before?.data();
    const after     = event.data?.after?.data();

    if (!after) return; // document deleted — never happens by design

    // New sale — pending and not yet processed
    if (after.status === 'pending' &&
        !after.stockProcessed &&
        !after.balanceProcessed) {
      await processSaleCreation(companyId, saleId, after);
      return;
    }

    // Void — isVoid just became true and not yet processed
    if (after.isVoid &&
        !after.voidProcessed &&
        before && !before.isVoid) {
      await processSaleVoid(companyId, saleId, after);
      return;
    }

    // All other writes (CF updating status, etc.) — ignore
  }
);

// ── Process new sale (idempotent) ─────────────────────────────
async function processSaleCreation(
  companyId: string,
  saleId:    string,
  sale:      FirebaseFirestore.DocumentData
): Promise<void> {
  const base    = `companies/${companyId}`;
  const saleRef = db.doc(`${base}/sales/${saleId}`);

  try {
    await db.runTransaction(async txn => {
      // ── IDEMPOTENCY CHECK ────────────────────────────────
      // Read the live sale inside the transaction.
      // If already processed, abort silently — do not double-write.
      const liveSaleSnap = await txn.get(saleRef);
      if (!liveSaleSnap.exists) return;
      const liveSale = liveSaleSnap.data()!;

      if (liveSale.stockProcessed || liveSale.balanceProcessed) {
        console.log(`[saleEngine] already processed, skipping: ${saleId}`);
        return;
      }

      // ── 1. Generate invoice number ───────────────────────
      const invoiceNumber = await generateInvoiceNumber(companyId, txn);

      // ── 2. Generate receipt number if needed ─────────────
      const needsReceipt = (sale.paymentType === 'cash' ||
                            sale.paymentType === 'partial') &&
                            sale.amountReceived > 0;
      let receiptNumber = '';
      let receiptId     = '';
      if (needsReceipt) {
        receiptNumber = await generateReceiptNumber(companyId, txn);
        receiptId     = db.collection(`${base}/receipts`).doc().id;
      }

      // ── 3. Read inventory settings once ─────────────────
      const settingsSnap  = await txn.get(
        db.doc(`${base}/settings/inventory`)
      );
      const allowNegative = settingsSnap.exists
        ? (settingsSnap.data()?.allowNegativeStock ?? false)
        : false;

      // ── 4. Stock check + decrement (same transaction) ────
      for (const item of sale.items) {
        const productRef  = db.doc(`${base}/products/${item.productId}`);
        const productSnap = await txn.get(productRef);
        if (!productSnap.exists) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const currentStock = productSnap.data()!.currentStock ?? 0;
        const newStock     = currentStock - item.qty;

        // Block negative stock unless company setting allows it
        if (newStock < 0 && !allowNegative) {
          throw new Error(
            `Insufficient stock for ${item.productName}: ` +
            `need ${item.qty}, have ${currentStock}`
          );
        }

        txn.update(productRef, {
          currentStock: newStock,
          updatedAt:    FieldValue.serverTimestamp(),
        });

        // Stock movement record
        txn.set(db.collection(`${base}/stockMovements`).doc(), {
          companyId,
          productId:   item.productId,
          productName: item.productName,
          type:        'SALE',
          qty:         -item.qty,
          refId:       saleId,
          refType:     'sale',
          notes:       null,
          createdAt:   FieldValue.serverTimestamp(),
          createdBy:   sale.createdBy,
        });
      }

      // ── 5. Customer balance update ────────────────────────
      // P2-5: Server-side credit limit enforcement.
      // UI check is first gate (UX). CF check is the real gate.
      // CF reads live customer data inside the transaction —
      // cannot be spoofed by the client.
      if (sale.amountDue > 0) {
        const customerRef  = db.doc(`${base}/customers/${sale.customerId}`);
        const customerSnap = await txn.get(customerRef);

        if (!customerSnap.exists) {
          throw new Error(`Customer not found: ${sale.customerId}`);
        }

        const customerData   = customerSnap.data()!;
        const currentBalance = customerData.currentBalance ?? 0;
        const creditLimit    = customerData.creditLimit ?? null;
        const newBalance     = currentBalance + sale.amountDue;

        // Check credit limit server-side
        if (creditLimit !== null && newBalance > creditLimit) {
          const override = sale.creditOverride;

          // Step 1: basic shape check
          const hasOverrideShape = override &&
            override.overridden === true &&
            typeof override.reason === 'string' &&
            override.reason.trim().length > 0 &&
            typeof override.by === 'string' &&
            override.by.trim().length > 0;

          if (!hasOverrideShape) {
            throw new Error(
              `credit limit exceeded: balance would be ${newBalance}, ` +
              `limit is ${creditLimit}. No valid override provided.`
            );
          }

          // Step 2: GPT catch — verify override.by is actually owner/admin
          // A forged UID from a sales user must be rejected here.
          // This read happens inside the transaction so it's consistent.
          const approverRef  = db.doc(
            `${base}/users/${override.by}`
          );
          const approverSnap = await txn.get(approverRef);

          if (!approverSnap.exists) {
            throw new Error(
              `credit limit override rejected: approver ${override.by} ` +
              `not found in company users.`
            );
          }

          const approverData = approverSnap.data()!;
          const approverRole = approverData.role as string;
          const approverStatus = approverData.status as string;

          const isAuthorised =
            (approverRole === 'owner' || approverRole === 'admin') &&
            approverStatus === 'active';

          if (!isAuthorised) {
            throw new Error(
              `credit limit override rejected: ${override.by} has role ` +
              `'${approverRole}' (${approverStatus}). ` +
              `Only active owner or admin can approve credit overrides.`
            );
          }

          // Override is valid — log to console and audit trail
          console.log(
            `[saleEngine] credit override verified: ` +
            `approved by ${approverRole} ${override.by} — ` +
            `${newBalance} > ${creditLimit} — reason: ${override.reason}`
          );
        }

        txn.update(customerRef, {
          currentBalance:   FieldValue.increment(sale.amountDue),
          balanceUpdatedAt: FieldValue.serverTimestamp(),
        });
      }

      // ── 6. Auto-receipt for cash/partial ─────────────────
      if (needsReceipt) {
        txn.set(db.doc(`${base}/receipts/${receiptId}`), {
          companyId,
          receiptNumber,
          customerId:    sale.customerId,
          saleId,                     // Point 7: links back to sale
          amount:        sale.amountReceived,
          paymentMethod: sale.paymentMethod,
          date:          sale.date,
          isVoid:        false,
          voidReason:    null,
          notes:         `Auto-receipt for ${invoiceNumber}`,
          source:        'system',    // Point 7: distinguishes auto vs manual
          createdAt:     FieldValue.serverTimestamp(),
          createdBy:     sale.createdBy,
        });
      }

      // ── 7. Audit log ──────────────────────────────────────
      txn.set(db.collection('auditLog').doc(), {
        companyId,
        action:    'SALE_CONFIRMED',
        entityType:'sale',
        entityId:  saleId,
        data: {
          invoiceNumber,
          customerId:     sale.customerId,
          grandTotal:     sale.grandTotal,
          amountDue:      sale.amountDue,
          paymentType:    sale.paymentType,
          // Point 9: full credit override audit trail
          creditOverride: sale.creditOverride ?? null,
        },
        performedBy: sale.createdBy,
        createdAt:   FieldValue.serverTimestamp(),
      });

      // ── 8. Mark sale as confirmed ─────────────────────────
      // stockProcessed + balanceProcessed = idempotency guards
      txn.update(saleRef, {
        invoiceNumber,
        receiptId:        receiptId || null,
        stockProcessed:   true,
        balanceProcessed: true,
        status:           'confirmed',
        updatedAt:        FieldValue.serverTimestamp(),
      });
    });

    console.log(`[saleEngine] confirmed: ${companyId}/${saleId}`);

  } catch (err) {
    const errMsg = String(err);

    // P1-3: Distinguish permanent vs transient failures.
    // Permanent = bad data or business rule violation.
    //   Do NOT rethrow — retrying will always fail again.
    // Transient = network timeout, Firestore contention.
    //   Rethrow so Firebase retries. Idempotency guard is safe.
    const isPermanent =
      errMsg.includes('Insufficient stock') ||
      errMsg.includes('Product not found') ||
      errMsg.includes('credit limit') ||
      errMsg.includes('Customer not found');

    await saleRef.update({
      status:        'failed',
      failureReason: errMsg,
      updatedAt:     FieldValue.serverTimestamp(),
    });

    console.error(
      `[saleEngine] ${isPermanent ? 'permanent' : 'transient'} ` +
      `failure: ${companyId}/${saleId}`, err
    );

    if (!isPermanent) throw err; // Transient: let Firebase retry safely
    // Permanent: do not rethrow — no point retrying
  }
}

// ── Process void (idempotent) ─────────────────────────────────
async function processSaleVoid(
  companyId: string,
  saleId:    string,
  sale:      FirebaseFirestore.DocumentData
): Promise<void> {
  const base    = `companies/${companyId}`;
  const saleRef = db.doc(`${base}/sales/${saleId}`);

  await db.runTransaction(async txn => {
    // ── IDEMPOTENCY CHECK ────────────────────────────────────
    // Read live sale inside transaction — abort if already voided
    const liveSaleSnap = await txn.get(saleRef);
    if (!liveSaleSnap.exists) return;
    const liveSale = liveSaleSnap.data()!;

    if (liveSale.voidProcessed) {
      console.log(`[saleEngine] void already processed, skipping: ${saleId}`);
      return;
    }

    // ── 1. Restore stock ──────────────────────────────────────
    for (const item of sale.items) {
      const productRef = db.doc(`${base}/products/${item.productId}`);
      txn.update(productRef, {
        currentStock: FieldValue.increment(item.qty),
        updatedAt:    FieldValue.serverTimestamp(),
      });

      // Reversal stock movement
      txn.set(db.collection(`${base}/stockMovements`).doc(), {
        companyId,
        productId:   item.productId,
        productName: item.productName,
        type:        'SALE_VOID',
        qty:         item.qty, // positive = back in
        refId:       saleId,
        refType:     'sale_void',
        notes:       sale.voidReason,
        createdAt:   FieldValue.serverTimestamp(),
        createdBy:   sale.voidedBy,
      });
    }

    // ── 2. Reverse customer balance ───────────────────────────
    if (sale.amountDue > 0) {
      txn.update(db.doc(`${base}/customers/${sale.customerId}`), {
        currentBalance:   FieldValue.increment(-sale.amountDue),
        balanceUpdatedAt: FieldValue.serverTimestamp(),
      });
    }

    // ── 3. Void linked receipt ────────────────────────────────
    if (sale.receiptId) {
      txn.update(db.doc(`${base}/receipts/${sale.receiptId}`), {
        isVoid:    true,
        voidReason:'Parent sale voided',
        voidedAt:  FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // ── 4. Audit log ──────────────────────────────────────────
    txn.set(db.collection('auditLog').doc(), {
      companyId,
      action:    'SALE_VOIDED',
      entityType:'sale',
      entityId:  saleId,
      data: {
        invoiceNumber: sale.invoiceNumber,
        customerId:    sale.customerId,
        grandTotal:    sale.grandTotal,
        amountDue:     sale.amountDue,
        voidReason:    sale.voidReason,
      },
      performedBy: sale.voidedBy,
      createdAt:   FieldValue.serverTimestamp(),
    });

    // ── 5. Mark void as processed ─────────────────────────────
    // P1-1: CF owns status change to 'voided' — not the client.
    // Client only sets isVoid=true. CF sets status here.
    // voidProcessed = idempotency guard for retries.
    txn.update(saleRef, {
      status:        'voided',
      voidProcessed: true,
      updatedAt:     FieldValue.serverTimestamp(),
    });
  });

  // ── 6. Notify owner (outside transaction — best effort) ───
  try {
    const ownerQuery = await db
      .collection(`${base}/users`)
      .where('role', '==', 'owner')
      .limit(1)
      .get();

    if (!ownerQuery.empty) {
      const ownerToken = ownerQuery.docs[0].data().fcmToken;
      if (ownerToken) {
        console.log(
          `[saleEngine] void notification queued for owner, ` +
          `token: ${ownerToken.substring(0, 10)}...`
        );
        // Uncomment when FCM is configured:
        // await getMessaging().send({
        //   token: ownerToken,
        //   notification: {
        //     title: 'Sale Voided',
        //     body: `${sale.invoiceNumber} — ${sale.voidReason}`,
        //   },
        //   data: { saleId, companyId },
        // });
      }
    }
  } catch (notifyErr) {
    // Best effort — never fail the void because of notification
    console.warn('[saleEngine] void notify failed:', notifyErr);
  }

  console.log(`[saleEngine] voided: ${companyId}/${saleId}`);
}
