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
  User,
  Calendar,
  ChevronDown,
  ChevronRight
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
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});

  const toggleUserExpand = (userId: string) => {
    setExpandedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    approved: false,
    quotaTier: 'free', // 'free' | '10routers' | '20routers' | 'custom'
    expiryType: '1month', // '1month' | '3months' | '6months' | '1year' | 'custom' | 'unlimited'
    customExpiryDate: '', // YYYY-MM-DD
    maxRouters: 1,
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

  // Helper to calculate expiry date
  const calculateExpiryDate = (type: string, customDate?: string): string | undefined => {
    const now = new Date();
    if (type === '1month') {
      now.setMonth(now.getMonth() + 1);
      return now.toISOString();
    }
    if (type === '3months') {
      now.setMonth(now.getMonth() + 3);
      return now.toISOString();
    }
    if (type === '6months') {
      now.setMonth(now.getMonth() + 6);
      return now.toISOString();
    }
    if (type === '1year') {
      now.setFullYear(now.getFullYear() + 1);
      return now.toISOString();
    }
    if (type === 'custom' && customDate) {
      const d = new Date(customDate);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        return d.toISOString();
      }
    }
    return undefined;
  };

  // Actions
  const handleQuotaTierChange = (tier: string) => {
    let limit = 1;
    let expType = '1month';
    if (tier === 'free') {
      limit = 1;
      expType = '1month';
    } else if (tier === 'quota1') {
      limit = 10;
      expType = 'unlimited';
    } else if (tier === 'quota2') {
      limit = 20;
      expType = 'unlimited';
    } else {
      limit = 5; // default custom limit
      expType = 'unlimited';
    }
    
    setFormData(prev => ({
      ...prev,
      quotaTier: tier,
      maxRouters: limit,
      expiryType: expType,
      approved: tier === 'free' ? true : prev.approved, // Auto-approve for free if chosen
    }));
  };

  const handleToggleApproval = async (user: UserDoc) => {
    if (!user.approved) {
      // Open edit modal directly to let admin choose quota/limit and save
      let type = '1month';
      let dateVal = '';
      if (user.expiresAt) {
        type = 'custom';
        dateVal = new Date(user.expiresAt).toISOString().split('T')[0];
      }
      
      // Determine the quotaTier based on quota or maxRouters
      let tier = user.quota || 'free';
      const limit = user.maxRouters !== undefined ? user.maxRouters : 1;
      if (!user.quota) {
        if (limit === 1 && user.expiresAt) {
          tier = 'free';
          type = '1month';
        } else if (limit === 10) {
          tier = 'quota1';
          type = 'unlimited';
        } else if (limit === 20) {
          tier = 'quota2';
          type = 'unlimited';
        } else {
          tier = 'custom';
        }
      } else {
        if (tier === 'free') {
          type = '1month';
        } else {
          type = 'unlimited';
        }
      }

      setFormData({
        name: user.name,
        email: user.email,
        approved: true, // auto-select approve
        quotaTier: tier,
        expiryType: type,
        customExpiryDate: dateVal,
        maxRouters: limit,
      });
      setCurrentUser(user);
      setIsEditOpen(true);
      return;
    }

    setActionLoading(user.id);
    try {
      await revokeUser(user.email);
      showToast(`Revoked approval for ${user.name}`, 'success');
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

  const handleAddClick = () => {
    setFormData({
      name: '',
      email: '',
      approved: false,
      quotaTier: 'free',
      expiryType: '1month',
      customExpiryDate: '',
      maxRouters: 1,
    });
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;

    setActionLoading('add');
    try {
      let expiresAt: string | undefined;
      if (formData.approved && formData.expiryType !== 'unlimited') {
        expiresAt = calculateExpiryDate(formData.expiryType, formData.customExpiryDate);
      }
      const res = await addUser(
        formData.name,
        formData.email,
        formData.approved,
        expiresAt,
        formData.approved ? formData.maxRouters : undefined,
        formData.approved ? formData.quotaTier : undefined
      );
      if (res.error) {
        showToast(res.error, 'error');
      } else {
        showToast(`User ${formData.name} added successfully`, 'success');
        setIsAddOpen(false);
        setFormData({
          name: '',
          email: '',
          approved: false,
          quotaTier: 'free',
          expiryType: '1month',
          customExpiryDate: '',
          maxRouters: 1,
        });
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
    let type = 'unlimited';
    let dateVal = '';
    if (user.expiresAt) {
      type = 'custom';
      dateVal = new Date(user.expiresAt).toISOString().split('T')[0];
    }
    
    // Determine the quotaTier based on quota or maxRouters
    let tier = user.quota || 'custom';
    const limit = user.maxRouters !== undefined ? user.maxRouters : 1;
    if (!user.quota) {
      if (limit === 1 && user.expiresAt) {
        tier = 'free';
        type = '1month';
      } else if (limit === 10) {
        tier = 'quota1';
      } else if (limit === 20) {
        tier = 'quota2';
      }
    } else {
      if (tier === 'free') {
        type = '1month';
      }
    }

    setFormData({
      name: user.name,
      email: user.email,
      approved: user.approved,
      quotaTier: tier,
      expiryType: type,
      customExpiryDate: dateVal,
      maxRouters: limit,
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !formData.name.trim()) return;

    setActionLoading('edit');
    try {
      let expiresAt: string | undefined;
      if (formData.approved && formData.expiryType !== 'unlimited') {
        expiresAt = calculateExpiryDate(formData.expiryType, formData.customExpiryDate);
      }
      await updateUser(
        currentUser.email,
        formData.name,
        formData.approved,
        expiresAt,
        formData.approved ? formData.maxRouters : undefined,
        formData.approved ? formData.quotaTier : undefined
      );
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

  // Helper to determine status
  const getUserStatus = (user: UserDoc) => {
    if (!user.approved) return 'pending';
    if (user.expiresAt && new Date(user.expiresAt) <= new Date()) return 'expired';
    return 'approved';
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = users.length;
    const approved = users.filter((u) => u.approved && (!u.expiresAt || new Date(u.expiresAt) > new Date())).length;
    const expired = users.filter((u) => u.approved && u.expiresAt && new Date(u.expiresAt) <= new Date()).length;
    const pending = total - approved - expired;
    return { total, approved, expired, pending };
  }, [users]);

  // Filter & Search computation
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.uid.toLowerCase().includes(searchQuery.toLowerCase());

      const status = getUserStatus(user);
      if (filter === 'approved') return matchesSearch && status === 'approved';
      if (filter === 'pending') return matchesSearch && status !== 'approved';
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

  const getRemainingDays = (dateStr: string) => {
    try {
      const diffTime = new Date(dateStr).getTime() - Date.now();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (e) {
      return null;
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
              <Users size={18} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <h3>Approved Access</h3>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.approved}</div>
            </div>
            <div className="stat-icon" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
              <ShieldCheck size={18} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <h3>Expired Access</h3>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.expired}</div>
            </div>
            <div className="stat-icon" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
              <Clock size={18} />
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
              <Clock size={18} />
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

          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleAddClick}>
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
            <div className="user-cards-list">
              {filteredUsers.map((user) => {
                const status = getUserStatus(user);
                const isExpanded = !!expandedUsers[user.id];
                return (
                  <div 
                    key={user.id} 
                    className="user-mobile-card" 
                    style={{ cursor: 'pointer' }} 
                    onClick={() => toggleUserExpand(user.id)}
                  >
                    <div className="user-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="user-identity" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                        <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '14px' }}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-details">
                          <span className="user-name" style={{ fontSize: '14px' }}>{user.name}</span>
                          <span className="user-email" style={{ fontSize: '11px' }}>{user.email}</span>
                          {user.expiresAt && user.approved && (() => {
                            const days = getRemainingDays(user.expiresAt);
                            if (days === null) return null;
                            return (
                              <span style={{ 
                                fontSize: '10px', 
                                color: days > 0 ? 'var(--text-secondary)' : 'var(--danger)',
                                marginTop: '2px',
                                display: 'block',
                                fontWeight: '500'
                              }}>
                                {days > 0 ? `${days} days left` : 'Expired'}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-info" style={{ 
                          backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                          color: '#3b82f6', 
                          borderColor: 'rgba(59, 130, 246, 0.2)',
                          padding: '2px 6px',
                          fontSize: '10px'
                        }}>
                          {user.routerCount} / {user.maxRouters || 1} R
                        </span>
                        <span className={`badge ${
                          status === 'approved' ? 'badge-success' : 
                          status === 'expired' ? 'badge-danger' : 
                          'badge-warning'
                        }`} style={{ fontSize: '10px', padding: '4px 8px' }}>
                          {status === 'approved' ? 'Approved' : 
                           status === 'expired' ? 'Expired' : 
                           'Pending'}
                        </span>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="user-card-body" onClick={(e) => e.stopPropagation()} style={{ marginTop: '12px', borderTop: '1px solid var(--card-border)', paddingTop: '12px' }}>
                        <div className="user-card-meta">
                          <span className="meta-label">UID:</span>
                          <span className="user-uid" style={{ wordBreak: 'break-all', fontSize: '11px' }}>{user.uid}</span>
                        </div>
                        <div className="user-card-meta">
                          <span className="meta-label">Registered:</span>
                          <span className="meta-value">{formatDate(user.createdAt)}</span>
                        </div>
                        {user.approvedAt && (
                          <div className="user-card-meta">
                            <span className="meta-label">Approved:</span>
                            <span className="meta-value">{formatDate(user.approvedAt)}</span>
                          </div>
                        )}
                        <div className="user-card-meta">
                          <span className="meta-label">Expires:</span>
                          <span className="meta-value">
                            {user.expiresAt ? (
                              <>
                                {formatDate(user.expiresAt)}
                                {user.approved && (() => {
                                  const days = getRemainingDays(user.expiresAt);
                                  if (days === null) return null;
                                  return (
                                    <span style={{ 
                                      marginLeft: '8px', 
                                      color: days > 0 ? '#10b981' : 'var(--danger)',
                                      fontWeight: '600',
                                      fontSize: '11px'
                                    }}>
                                      ({days > 0 ? `${days} days left` : 'Expired'})
                                    </span>
                                  );
                                })()}
                              </>
                            ) : (
                              user.approved ? 'Lifetime' : '—'
                            )}
                          </span>
                        </div>
                        {user.approved && (
                          <>
                            <div className="user-card-meta">
                              <span className="meta-label">Quota Plan:</span>
                              <span className="meta-value" style={{ textTransform: 'capitalize' }}>
                                {user.quota === 'quota1' ? 'Quota 1' : user.quota === 'quota2' ? 'Quota 2' : user.quota || 'Free'}
                              </span>
                            </div>
                            <div className="user-card-meta">
                              <span className="meta-label">Router Limit:</span>
                              <span className="meta-value">{user.maxRouters || 1} router(s)</span>
                            </div>
                          </>
                        )}

                        <div className="user-card-actions" style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                          <button
                            className={`action-btn ${user.approved ? 'revoke' : 'approve'}`}
                            onClick={(e) => { e.stopPropagation(); handleToggleApproval(user); }}
                            disabled={actionLoading === user.id}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '36px', fontSize: '13px' }}
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
                            onClick={(e) => { e.stopPropagation(); handleEditClick(user); }}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '36px', fontSize: '13px' }}
                          >
                            <Edit2 size={14} />
                            <span>Edit</span>
                          </button>

                          <button
                            className="action-btn delete"
                            onClick={(e) => { e.stopPropagation(); handleDelete(user.email); }}
                            disabled={actionLoading === user.id}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '36px', fontSize: '13px' }}
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
                    )}
                  </div>
                );
              })}
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

                {formData.approved && (
                  <>
                    <div className="form-group" style={{ marginTop: '20px' }}>
                      <label className="form-label" htmlFor="new-tier">
                        Quota Plan / Tier
                      </label>
                      <select
                        id="new-tier"
                        className="form-input"
                        value={formData.quotaTier}
                        onChange={(e) => handleQuotaTierChange(e.target.value)}
                        style={{ paddingLeft: '16px', background: 'rgba(8, 12, 20, 0.5)' }}
                      >
                        <option value="free">Free (1 Month Free, 1 Router)</option>
                        <option value="quota1">Quota 1 (10 Routers, Lifetime/Custom duration)</option>
                        <option value="quota2">Quota 2 (20 Routers, Lifetime/Custom duration)</option>
                        <option value="custom">Custom Quota...</option>
                      </select>
                    </div>

                    {formData.quotaTier === 'custom' && (
                      <div className="form-group" style={{ marginTop: '12px' }}>
                        <label className="form-label" htmlFor="new-max-routers">
                          Router Quota Limit
                        </label>
                        <input
                          id="new-max-routers"
                          type="number"
                          min="1"
                          className="form-input"
                          value={formData.maxRouters}
                          onChange={(e) => setFormData({ ...formData, maxRouters: parseInt(e.target.value, 10) || 1 })}
                          required
                          style={{ paddingLeft: '16px' }}
                        />
                      </div>
                    )}

                    <div className="form-group" style={{ marginTop: '16px' }}>
                      <label className="form-label" htmlFor="new-expiry">
                        Approval Expiry
                      </label>
                      <select
                        id="new-expiry"
                        className="form-input"
                        value={formData.expiryType}
                        onChange={(e) => setFormData({ ...formData, expiryType: e.target.value })}
                        style={{ paddingLeft: '16px', background: 'rgba(8, 12, 20, 0.5)' }}
                      >
                        <option value="unlimited">Lifetime / No Expiry</option>
                        <option value="1month">1 Month</option>
                        <option value="3months">3 Months</option>
                        <option value="6months">6 Months</option>
                        <option value="1year">1 Year</option>
                        <option value="custom">Custom Date</option>
                      </select>

                      {formData.expiryType === 'custom' && (
                        <div style={{ marginTop: '12px' }}>
                          <label className="form-label" htmlFor="new-expiry-date">
                            Choose Expiration Date
                          </label>
                          <input
                            id="new-expiry-date"
                            type="date"
                            className="form-input"
                            value={formData.customExpiryDate}
                            onChange={(e) => setFormData({ ...formData, customExpiryDate: e.target.value })}
                            required={formData.expiryType === 'custom'}
                            style={{ paddingLeft: '16px' }}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
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

                {formData.approved && (
                  <>
                    <div className="form-group" style={{ marginTop: '20px' }}>
                      <label className="form-label" htmlFor="edit-tier">
                        Quota Plan / Tier
                      </label>
                      <select
                        id="edit-tier"
                        className="form-input"
                        value={formData.quotaTier}
                        onChange={(e) => handleQuotaTierChange(e.target.value)}
                        style={{ paddingLeft: '16px', background: 'rgba(8, 12, 20, 0.5)' }}
                      >
                        <option value="free">Free (1 Month Free, 1 Router)</option>
                        <option value="quota1">Quota 1 (10 Routers, Lifetime/Custom duration)</option>
                        <option value="quota2">Quota 2 (20 Routers, Lifetime/Custom duration)</option>
                        <option value="custom">Custom Quota...</option>
                      </select>
                    </div>

                    {formData.quotaTier === 'custom' && (
                      <div className="form-group" style={{ marginTop: '12px' }}>
                        <label className="form-label" htmlFor="edit-max-routers">
                          Router Quota Limit
                        </label>
                        <input
                          id="edit-max-routers"
                          type="number"
                          min="1"
                          className="form-input"
                          value={formData.maxRouters}
                          onChange={(e) => setFormData({ ...formData, maxRouters: parseInt(e.target.value, 10) || 1 })}
                          required
                          style={{ paddingLeft: '16px' }}
                        />
                      </div>
                    )}

                    <div className="form-group" style={{ marginTop: '16px' }}>
                      <label className="form-label" htmlFor="edit-expiry">
                        Approval Expiry
                      </label>
                      <select
                        id="edit-expiry"
                        className="form-input"
                        value={formData.expiryType}
                        onChange={(e) => setFormData({ ...formData, expiryType: e.target.value })}
                        style={{ paddingLeft: '16px', background: 'rgba(8, 12, 20, 0.5)' }}
                      >
                        <option value="unlimited">Lifetime / No Expiry</option>
                        <option value="1month">1 Month</option>
                        <option value="3months">3 Months</option>
                        <option value="6months">6 Months</option>
                        <option value="1year">1 Year</option>
                        <option value="custom">Custom Date</option>
                      </select>

                      {formData.expiryType === 'custom' && (
                        <div style={{ marginTop: '12px' }}>
                          <label className="form-label" htmlFor="edit-expiry-date">
                            Choose Expiration Date
                          </label>
                          <input
                            id="edit-expiry-date"
                            type="date"
                            className="form-input"
                            value={formData.customExpiryDate}
                            onChange={(e) => setFormData({ ...formData, customExpiryDate: e.target.value })}
                            required={formData.expiryType === 'custom'}
                            style={{ paddingLeft: '16px' }}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
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
