import { create } from 'zustand';
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { nanoid } from '../utils/nanoid';
import type { CashDebt, OrderItem } from '../types';

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

interface CreateTableDebtInput {
  customerName: string;
  tableId: string;
  tableLabel: string;
  orderIds: string[];
  items: OrderItem[];
  totalAmount: number;
  mergedTableIds: string[];
}

interface DebtStore {
  debts: CashDebt[];
  loading: boolean;
  subscribe: () => () => void;
  createTableDebt: (input: CreateTableDebtInput) => Promise<void>;
  recordPayment: (debtId: string, amount: number) => Promise<void>;
}

export const useDebtStore = create<DebtStore>((set) => ({
  debts: [],
  loading: true,

  subscribe: () => onSnapshot(
    query(collection(db, 'cashDebts')),
    (snapshot) => {
      const debts = snapshot.docs.map((debtDoc) => {
        const data = debtDoc.data();
        return {
          ...data,
          id: debtDoc.id,
          paidAmount: typeof data.paidAmount === 'number' ? data.paidAmount : 0,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        } as CashDebt;
      }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      set({ debts, loading: false });
    },
    (error) => {
      console.error('cashDebtStore subscribe error:', error);
      set({ loading: false });
    },
  ),

  createTableDebt: async (input) => {
    if (!input.customerName.trim()) throw new Error('Müşteri adı boş olamaz.');
    if (!input.orderIds.length) throw new Error('Borç oluşturmak için açık sipariş bulunamadı.');
    if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
      throw new Error('Borç tutarı geçersiz.');
    }
    if (input.orderIds.length + input.mergedTableIds.length + 2 > 500) {
      throw new Error('Hesap çok büyük; borç kaydı tek işlemde kapatılamıyor.');
    }

    const batch = writeBatch(db);
    const debtRef = doc(collection(db, 'cashDebts'));
    const tableRef = doc(db, 'tables', input.tableId);
    const sessionId = nanoid(12);

    batch.set(debtRef, {
      customerName: input.customerName.trim(),
      tableId: input.tableId,
      tableLabel: input.tableLabel,
      orderIds: input.orderIds,
      items: input.items,
      totalAmount: input.totalAmount,
      paidAmount: 0,
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    input.orderIds.forEach((orderId) => {
      batch.update(doc(db, 'orders', orderId), {
        status: 'paid',
        paymentStatus: 'credit',
        debtId: debtRef.id,
        updatedAt: serverTimestamp(),
      });
    });

    batch.update(tableRef, {
      sessionId,
      status: 'needs_cleaning',
      mergedTableIds: [],
      mergedTableNumbers: [],
      updatedAt: serverTimestamp(),
    });

    input.mergedTableIds.forEach((tableId) => {
      batch.update(doc(db, 'tables', tableId), {
        status: 'needs_cleaning',
        mergedIntoId: null,
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  },

  recordPayment: async (debtId, amount) => {
    const paymentCents = Math.round(amount * 100);
    if (!Number.isFinite(amount) || paymentCents <= 0) {
      throw new Error('Tahsilat tutarı sıfırdan büyük olmalıdır.');
    }

    const debtRef = doc(db, 'cashDebts', debtId);
    const paymentRef = doc(collection(db, 'cashDebts', debtId, 'payments'));

    await runTransaction(db, async (transaction) => {
      const debtSnapshot = await transaction.get(debtRef);
      if (!debtSnapshot.exists()) throw new Error('Borç kaydı bulunamadı.');

      const data = debtSnapshot.data();
      const totalCents = Math.round(Number(data.totalAmount) * 100);
      const paidCents = Math.round(Number(data.paidAmount || 0) * 100);
      const remainingCents = totalCents - paidCents;
      if (
        !Number.isFinite(totalCents)
        || !Number.isFinite(paidCents)
        || totalCents <= 0
        || paidCents < 0
      ) {
        throw new Error('Borç kaydındaki tutar geçersiz.');
      }
      if (remainingCents <= 0) {
        throw new Error('Bu borç zaten kapatılmış.');
      }
      if (paymentCents > remainingCents) {
        throw new Error('Tahsilat kalan borç tutarından fazla olamaz.');
      }

      const nextPaidCents = paidCents + paymentCents;
      const orderRefs = nextPaidCents >= totalCents
        ? (Array.isArray(data.orderIds) ? data.orderIds : []).map((orderId: string) => doc(db, 'orders', orderId))
        : [];
      const orderSnapshots = await Promise.all(orderRefs.map((orderRef) => transaction.get(orderRef)));
      if (orderSnapshots.some((snapshot) => !snapshot.exists())) {
        throw new Error('Borçla ilişkili siparişlerden biri bulunamadı; tahsilat kaydedilmedi.');
      }

      transaction.update(debtRef, {
        paidAmount: nextPaidCents / 100,
        status: nextPaidCents >= totalCents ? 'paid' : 'open',
        updatedAt: serverTimestamp(),
        ...(nextPaidCents >= totalCents ? { paidAt: serverTimestamp() } : {}),
      });
      transaction.set(paymentRef, {
        amount: paymentCents / 100,
        createdAt: serverTimestamp(),
      });
      orderRefs.forEach((orderRef) => {
        transaction.update(orderRef, {
          paymentStatus: 'paid',
          updatedAt: serverTimestamp(),
        });
      });
    });
  },
}));
