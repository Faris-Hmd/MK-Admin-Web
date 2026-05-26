'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  checkAuthStatus,
  logout,
  getUsers,
  approveUser,
  revokeUser,
  deleteUser,
  addUser,
  updateUser,
  UserDoc
} from './actions';
import {
  Users,
  ShieldCheck,
  Clock,
  Search,
  Plus,
  LogOut,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  UserCheck,
  UserX,
  Mail,
  User
} from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

export default function DashboardPage() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // holds user id of action
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserDoc | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    approved: false,
  });

  // Verify authentication on mount
  useEffect(() => {
    async function init() {
      try {
        const auth = await checkAuthStatus();
        if (!auth.authenticated) {
          router.push('/login');
          return;
        }
        await loadUsers();
      } catch (err) {
        showToast('Session expired. Please log in again.', 'error');
        router.push('/login');
      }
    }
    init();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch users', 'error');
      if (err.message === 'Unauthorized') {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      showToast('Logout failed', 'error');
    }
  };

  // Actions
  const handleToggleApproval = async (user: UserDoc) => {
    setActionLoading(user.id);
    try {
      if (user.approved) {
        await revokeUser(user.email);
        showToast(`Revoked approval for ${user.name}`, 'success');
      } else {
        await approveUser(user.email);
        showToast(`Approved access for ${user.name}`, 'success');
      }
      await loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Action failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (email: string) => {
    if (!confirm(`Are you sure you want to delete ${email}?`)) return;
    setActionLoading(email);
    try {
      await deleteUser(email);
      showToast(`User ${email} deleted successfully`, 'success');
      await loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;

    setActionLoading('add');
    try {
      const res = await addUser(formData.name, formData.email, formData.approved);
      if (res.error) {
        showToast(res.error, 'error');
      } else {
        showToast(`User ${formData.name} added successfully`, 'success');
        setIsAddOpen(false);
        setFormData({ name: '', email: '', approved: false });
        await loadUsers();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to add user', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditClick = (user: UserDoc) => {
    setCurrentUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      approved: user.approved,
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !formData.name.trim()) return;

    setActionLoading('edit');
    try {
      await updateUser(currentUser.email, formData.name, formData.approved);
      showToast(`User ${currentUser.email} updated successfully`, 'success');
      setIsEditOpen(false);
      setCurrentUser(null);
      await loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to update user', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = users.length;
    const approved = users.filter((u) => u.approved).length;
    const pending = total - approved;
    return { total, approved, pending };
  }, [users]);

  // Filter & Search computation
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.uid.toLowerCase().includes(searchQuery.toLowerCase());

      if (filter === 'approved') return matchesSearch && user.approved;
      if (filter === 'pending') return matchesSearch && !user.approved;
      return matchesSearch;
    });
  }, [users, searchQuery, filter]);

  // Formatting date
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="dashboard-container">
      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === 'success' ? (
              <CheckCircle size={18} style={{ color: 'var(--success)' }} />
            ) : (
              <XCircle size={18} style={{ color: 'var(--danger)' }} />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Navigation bar */}
      <nav className="navbar">
        <div className="nav-brand">
          <div className="nav-logo">
            <Users size={20} />
          </div>
          <span className="nav-title">MK Voucher App</span>
          <span className="badge badge-success" style={{ padding: '4px 8px', fontSize: '10px' }}>
            Admin Dashboard
          </span>
        </div>

        <div className="nav-actions">
          <div className="user-badge">
            <User size={14} />
            <span>Administrator</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </nav>

      {/* Main dashboard content */}
      <main className="dashboard-content">
        {/* Statistics overview */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-info">
              <h3>Total Registered</h3>
              <div className="stat-value">{stats.total}</div>
            </div>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
              <Users size={28} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <h3>Approved Access</h3>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.approved}</div>
            </div>
            <div className="stat-icon" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
              <ShieldCheck size={28} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <h3>Pending Approvals</h3>
              <div className="stat-value" style={{ color: stats.pending > 0 ? 'var(--warning)' : '#fff' }}>
                {stats.pending}
              </div>
            </div>
            <div className="stat-icon" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}>
              <Clock size={28} />
            </div>
          </div>
        </section>

        {/* Action and controls panel */}
        <section className="controls-panel">
          <div className="search-filter-group">
            <div className="search-bar">
              <Search className="input-icon" size={16} style={{ left: '16px' }} />
              <input
                type="text"
                placeholder="Search by name, email, or UID..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-tabs">
              <button
                className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-tab ${filter === 'approved' ? 'active' : ''}`}
                onClick={() => setFilter('approved')}
              >
                Approved
              </button>
              <button
                className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
                onClick={() => setFilter('pending')}
              >
                Pending
              </button>
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setIsAddOpen(true)}>
            <Plus size={16} />
            Add User
          </button>
        </section>

        {/* Users list / Table */}
        <section className="table-card">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px' }}>
              <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Loading user directory...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Users size={32} />
              </div>
              <h3>No users found</h3>
              <p>No user documents match your current filter or search query.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <table className="users-table desktop-only">
                <thead>
                  <tr>
                    <th>User Identity</th>
                    <th>Status</th>
                    <th>Firestore UID</th>
                    <th>Registered At</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-identity">
                          <div className="user-avatar">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="user-details">
                            <span className="user-name">{user.name}</span>
                            <span className="user-email">{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${user.approved ? 'badge-success' : 'badge-warning'}`}>
                          {user.approved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <span className="user-uid">{user.uid}</span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                          {formatDate(user.createdAt)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className={`action-btn ${user.approved ? 'revoke' : 'approve'}`}
                            onClick={() => handleToggleApproval(user)}
                            disabled={actionLoading === user.id}
                            title={user.approved ? 'Revoke Approval' : 'Approve Access'}
                          >
                            {actionLoading === user.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : user.approved ? (
                              <UserX size={16} />
                            ) : (
                              <UserCheck size={16} />
                            )}
                          </button>

                          <button
                            className="action-btn"
                            onClick={() => handleEditClick(user)}
                            title="Edit User Details"
                          >
                            <Edit2 size={16} />
                          </button>

                          <button
                            className="action-btn delete"
                            onClick={() => handleDelete(user.email)}
                            disabled={actionLoading === user.id}
                            title="Delete User Account"
                          >
                            {actionLoading === user.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Card List View */}
              <div className="mobile-only">
                <div className="user-cards-list">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="user-mobile-card">
                      <div className="user-card-header">
                        <div className="user-identity">
                          <div className="user-avatar">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="user-details">
                            <span className="user-name">{user.name}</span>
                            <span className="user-email">{user.email}</span>
                          </div>
                        </div>
                        <span className={`badge ${user.approved ? 'badge-success' : 'badge-warning'}`}>
                          {user.approved ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                      
                      <div className="user-card-body">
                        <div className="user-card-meta">
                          <span className="meta-label">UID:</span>
                          <span className="user-uid" style={{ wordBreak: 'break-all' }}>{user.uid}</span>
                        </div>
                        <div className="user-card-meta">
                          <span className="meta-label">Registered:</span>
                          <span className="meta-value">{formatDate(user.createdAt)}</span>
                        </div>
                      </div>

                      <div className="user-card-actions">
                        <button
                          className={`action-btn ${user.approved ? 'revoke' : 'approve'}`}
                          onClick={() => handleToggleApproval(user)}
                          disabled={actionLoading === user.id}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          {actionLoading === user.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : user.approved ? (
                            <>
                              <UserX size={14} />
                              <span>Revoke</span>
                            </>
                          ) : (
                            <>
                              <UserCheck size={14} />
                              <span>Approve</span>
                            </>
                          )}
                        </button>
                        
                        <button
                          className="action-btn"
                          onClick={() => handleEditClick(user)}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <Edit2 size={14} />
                          <span>Edit</span>
                        </button>
                        
                        <button
                          className="action-btn delete"
                          onClick={() => handleDelete(user.email)}
                          disabled={actionLoading === user.id}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          {actionLoading === user.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <>
                              <Trash2 size={14} />
                              <span>Delete</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      {/* Add User Modal */}
      {isAddOpen && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2 className="modal-title">Register New User</h2>
              <button className="modal-close" onClick={() => setIsAddOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="new-name">
                    Display Name
                  </label>
                  <div className="input-wrapper">
                    <User className="input-icon" size={16} />
                    <input
                      id="new-name"
                      type="text"
                      className="form-input"
                      placeholder="e.g. John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="new-email">
                    Google Account Email
                  </label>
                  <div className="input-wrapper">
                    <Mail className="input-icon" size={16} />
                    <input
                      id="new-email"
                      type="email"
                      className="form-input"
                      placeholder="john.doe@gmail.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Access Status</label>
                  <div className="toggle-group">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={formData.approved}
                        onChange={(e) => setFormData({ ...formData, approved: e.target.checked })}
                      />
                      <span className="slider"></span>
                    </label>
                    <span className="toggle-label" onClick={() => setFormData({ ...formData, approved: !formData.approved })}>
                      {formData.approved ? 'Approve Access Immediately' : 'Leave Pending Approval'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '10px 20px' }}
                  onClick={() => setIsAddOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '10px 20px' }}
                  disabled={actionLoading === 'add'}
                >
                  {actionLoading === 'add' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Add User'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditOpen && currentUser && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2 className="modal-title">Edit User Settings</h2>
              <button className="modal-close" onClick={() => setIsEditOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-email">
                    Email (Read-only)
                  </label>
                  <div className="input-wrapper" style={{ opacity: 0.7 }}>
                    <Mail className="input-icon" size={16} />
                    <input
                      id="edit-email"
                      type="email"
                      className="form-input"
                      value={formData.email}
                      disabled
                      style={{ cursor: 'not-allowed' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-name">
                    Display Name
                  </label>
                  <div className="input-wrapper">
                    <User className="input-icon" size={16} />
                    <input
                      id="edit-name"
                      type="text"
                      className="form-input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Access Status</label>
                  <div className="toggle-group">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={formData.approved}
                        onChange={(e) => setFormData({ ...formData, approved: e.target.checked })}
                      />
                      <span className="slider"></span>
                    </label>
                    <span className="toggle-label" onClick={() => setFormData({ ...formData, approved: !formData.approved })}>
                      {formData.approved ? 'Approved Access' : 'Access Suspended / Pending'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '10px 20px' }}
                  onClick={() => setIsEditOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '10px 20px' }}
                  disabled={actionLoading === 'edit'}
                >
                  {actionLoading === 'edit' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
