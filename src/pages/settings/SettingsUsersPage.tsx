import { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs,
  doc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { db, auth } from '@/firebase';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/permissions';
import type { UserRole } from '@/types';

// ─────────────────────────────────────────────────────────────
// For MVP: owner/admin adds a user by email + sets their role.
// The new user signs in with email + password on first login.
// userCompany/{uid} is written here so AuthContext can resolve
// their companyId on login.
//
// Future: Cloud Function handles invite email + userCompany write.
// The component shape stays the same — only the write path changes.
// ─────────────────────────────────────────────────────────────

interface StaffUser {
  uid:       string;
  name:      string;
  email:     string;
  phone:     string;
  role:      UserRole;
  status:    'active' | 'inactive';
  createdAt: any;
}

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'admin',      label: 'Admin',      desc: 'Full access except user management' },
  { value: 'sales',      label: 'Sales',      desc: 'Create sales and receipts, view customers' },
  { value: 'accountant', label: 'Accountant', desc: 'View all reports and transactions, no editing' },
  { value: 'viewer',     label: 'Viewer',     desc: 'Dashboard and inventory view only' },
];

export default function SettingsUsersPage() {
  const { companyId, role, uid: currentUid } = useAuth();
  const [users,   setUsers]   = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const canManage = can.manageUsers(role);

  useEffect(() => {
    loadUsers();
  }, [companyId]);

  async function loadUsers() {
    setLoading(true);
    try {
      const q = query(
        collection(db, `companies/${companyId}/users`),
        where('companyId', '==', companyId)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() } as StaffUser));
      // Sort: owner first, then by name
      list.sort((a, b) => {
        if (a.role === 'owner') return -1;
        if (b.role === 'owner') return 1;
        return a.name.localeCompare(b.name);
      });
      setUsers(list);
    } catch (err) {
      console.error('[SettingsUsers] load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function deactivateUser(targetUid: string) {
    if (!canManage) return;
    if (!window.confirm('Deactivate this user? They will lose access immediately.')) return;
    try {
      await updateDoc(doc(db, `companies/${companyId}/users/${targetUid}`), {
        status:    'inactive',
        updatedAt: serverTimestamp(),
      });
      setUsers(prev => prev.map(u => u.uid === targetUid ? { ...u, status: 'inactive' } : u));
    } catch (err) {
      console.error('[SettingsUsers] deactivate error:', err);
      alert('Failed to deactivate user. Please try again.');
    }
  }

  async function reactivateUser(targetUid: string) {
    if (!canManage) return;
    try {
      await updateDoc(doc(db, `companies/${companyId}/users/${targetUid}`), {
        status:    'active',
        updatedAt: serverTimestamp(),
      });
      setUsers(prev => prev.map(u => u.uid === targetUid ? { ...u, status: 'active' } : u));
    } catch (err) {
      console.error('[SettingsUsers] reactivate error:', err);
      alert('Failed to reactivate user. Please try again.');
    }
  }

  const roleBadge = (r: UserRole) => {
    const colors: Record<UserRole, string> = {
      owner:      'bg-emerald-100 text-emerald-800',
      admin:      'bg-blue-100 text-blue-800',
      sales:      'bg-amber-100 text-amber-800',
      accountant: 'bg-purple-100 text-purple-800',
      viewer:     'bg-gray-100 text-gray-600',
    };
    return colors[r] ?? 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Team members</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage who has access to your TradeFlow account
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            <i className="ti ti-plus" aria-hidden="true" />
            Add user
          </button>
        )}
      </div>

      {/* Role info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs font-medium text-blue-800 mb-2">Role permissions</p>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map(r => (
            <div key={r.value} className="flex items-start gap-2">
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded mt-0.5 ${roleBadge(r.value)}`}>
                {r.label}
              </span>
              <span className="text-xs text-blue-700">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Users list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading team members...</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map(user => (
              <div key={user.uid} className="flex items-center gap-3 p-4">
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${user.status === 'inactive' ? 'bg-gray-100 text-gray-400' : 'bg-emerald-100 text-emerald-700'}`}>
                  {user.name?.substring(0, 2).toUpperCase() || '??'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-medium ${user.status === 'inactive' ? 'text-gray-400' : 'text-gray-900'}`}>
                      {user.name}
                      {user.uid === currentUid && (
                        <span className="ml-1.5 text-xs text-gray-400">(you)</span>
                      )}
                    </p>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${roleBadge(user.role)}`}>
                      {user.role}
                    </span>
                    {user.status === 'inactive' && (
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                        inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>
                </div>

                {/* Actions */}
                {canManage && user.role !== 'owner' && (
                  <div>
                    {user.status === 'active' ? (
                      <button
                        onClick={() => deactivateUser(user.uid)}
                        className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => reactivateUser(user.uid)}
                        className="text-xs text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add user modal */}
      {showAdd && canManage && (
        <AddUserModal
          companyId={companyId}
          currentUid={currentUid}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); loadUsers(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Add User Modal
// MVP: creates Firebase Auth account + writes user doc +
//      writes userCompany index. Staff logs in with email+pass.
// Future: Cloud Function sends invite email instead.
// ─────────────────────────────────────────────────────────────
interface AddUserModalProps {
  companyId:  string;
  currentUid: string;
  onClose:    () => void;
  onAdded:    () => void;
}

function AddUserModal({ companyId, currentUid, onClose, onAdded }: AddUserModalProps) {
  const [form, setForm] = useState({
    name:     '',
    email:    '',
    phone:    '',
    role:     'sales' as UserRole,
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Name, email and password are required.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true); setError('');

    try {
      // Create Firebase Auth account for the new user
      const credential = await createUserWithEmailAndPassword(
        auth, form.email.trim(), form.password
      );
      const newUid = credential.user.uid;
      const now    = serverTimestamp();

      // Write user document inside company
      await setDoc(doc(db, `companies/${companyId}/users/${newUid}`), {
        companyId,
        uid:       newUid,
        name:      form.name.trim(),
        email:     form.email.trim(),
        phone:     form.phone.trim(),
        role:      form.role,
        status:    'active',
        fcmToken:  null,
        createdAt: now,
        updatedAt: now,
        createdBy: currentUid,
      });

      // Write userCompany index — this is what AuthContext uses on login
      await setDoc(doc(db, `userCompany/${newUid}`), {
        uid:       newUid,
        companyId,
        createdAt: now,
      });

      onAdded();
    } catch (err: any) {
      console.error('[AddUser]', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. They may already have a TradeFlow account.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else {
        setError('Failed to add user. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-900">Add team member</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="ti ti-x text-lg" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name *</label>
            <input
              type="text" required value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="Ahmed Al Mansoori"
              className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
            <input
              type="email" required value={form.email}
              onChange={e => update('email', e.target.value)}
              placeholder="ahmed@company.com"
              className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input
              type="tel" value={form.phone}
              onChange={e => update('phone', e.target.value)}
              placeholder="+973 3300 0000"
              className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role *</label>
            <select
              value={form.role}
              onChange={e => update('role', e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none transition-colors bg-white"
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Temporary password *
            </label>
            <input
              type="password" required value={form.password}
              onChange={e => update('password', e.target.value)}
              placeholder="Min 8 characters"
              className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
            />
            <p className="text-xs text-gray-400 mt-1">
              Share this with the team member. They can change it after logging in.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 h-11 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              className="flex-1 h-11 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Adding...' : 'Add user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
