'use client';

import { useState, useTransition } from 'react';
import {
  createStaffMember,
  deactivateStaffMember,
  reactivateStaffMember,
  updateStaffCredentials,
  deleteStaffMember,
} from '@/app/actions/staff';

type StaffMember = {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'staff';
  isActive: boolean;
};

type TeamPanelProps = {
  members: StaffMember[];
  currentUserId: string;
};

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function TeamPanel({ members, currentUserId }: TeamPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [createMessage, setCreateMessage] = useState('');

  const activeCount = members.filter((m) => m.isActive).length;

  function handleToggle(id: string, isActive: boolean) {
    startTransition(async () => {
      if (isActive) {
        await deactivateStaffMember(id);
      } else {
        await reactivateStaffMember(id);
      }
    });
  }

  function openEditForm(member: StaffMember) {
    setEditUserId(member.id);
    setEditFullName(member.fullName);
    setEditEmail(member.email);
    setEditPassword('');
    setEditConfirmPassword('');
    setEditError('');
    setEditSuccess('');
  }

  function closeEditForm() {
    setEditUserId(null);
    setEditFullName('');
    setEditEmail('');
    setEditPassword('');
    setEditConfirmPassword('');
    setEditError('');
    setEditSuccess('');
  }

  function handleUpdateCredentials(e: React.FormEvent, userId: string) {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');

    if (editPassword && editPassword.length < 6) {
      setEditError('Password must be at least 6 characters.');
      return;
    }

    if (editPassword && editPassword !== editConfirmPassword) {
      setEditError('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      const result = await updateStaffCredentials({
        userId,
        fullName: editFullName,
        email: editEmail,
        password: editPassword || undefined,
      });

      if (result.error) {
        setEditError(result.error);
        return;
      }

      setEditSuccess('Credentials updated.');
      setEditPassword('');
      setEditConfirmPassword('');
      setTimeout(() => closeEditForm(), 2000);
    });
  }

  function handleRemove(member: StaffMember) {
    if (!confirm(`Remove ${member.fullName}? This permanently deletes their account.`)) {
      return;
    }

    setRemovingId(member.id);
    startTransition(async () => {
      const result = await deleteStaffMember(member.id);
      setRemovingId(null);
      if (result.error) {
        alert(result.error);
      }
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateMessage('');

    if (newPassword.length < 6) {
      setCreateMessage('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== newConfirmPassword) {
      setCreateMessage('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      const result = await createStaffMember({
        email: newEmail,
        fullName: newFullName,
        password: newPassword,
      });
      if (result.error) {
        setCreateMessage(result.error);
        return;
      }
      setCreateMessage('Staff member created.');
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewConfirmPassword('');
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Live team</p>
          <p className="text-sm font-bold text-on-surface">{activeCount} active</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-green-500/15 text-green-400">
          {members.length} total
        </span>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-on-surface-variant py-4">No team members yet.</p>
      ) : (
        <div className="space-y-3">
          {members.map((member) => {
            const isSelf = member.id === currentUserId;
            const isAdmin = member.role === 'admin';
            const canManage = !isSelf && !isAdmin;

            return (
              <div
                key={member.id}
                className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/10"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {initials(member.fullName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-on-surface truncate">{member.fullName}</p>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          member.role === 'admin'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        {member.role}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          member.isActive ? 'bg-green-500/15 text-green-400' : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant truncate mt-0.5">{member.email}</p>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              editUserId === member.id ? closeEditForm() : openEditForm(member)
                            }
                            className="px-3 py-1 text-[10px] font-black uppercase tracking-widest border border-outline-variant/30 text-on-surface hover:border-primary disabled:opacity-50"
                          >
                            {editUserId === member.id ? 'Cancel' : 'Edit'}
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleToggle(member.id, member.isActive)}
                            className="px-3 py-1 text-[10px] font-black uppercase tracking-widest border border-outline-variant/30 text-on-surface hover:border-primary disabled:opacity-50"
                          >
                            {member.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                          <button
                            type="button"
                            disabled={isPending || removingId === member.id}
                            onClick={() => handleRemove(member)}
                            className="px-3 py-1 text-[10px] font-black uppercase tracking-widest border border-error text-error disabled:opacity-50"
                          >
                            {removingId === member.id ? 'Removing...' : 'Remove'}
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          {isSelf ? 'Current session' : 'Protected'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {canManage && editUserId === member.id && (
                  <form
                    onSubmit={(e) => handleUpdateCredentials(e, member.id)}
                    className="mt-4 pt-4 border-t border-outline-variant/10 grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    {editError && <p className="sm:col-span-2 text-xs font-medium text-error">{editError}</p>}
                    {editSuccess && (
                      <p className="sm:col-span-2 text-xs font-medium text-green-400">{editSuccess}</p>
                    )}
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        className="w-full bg-surface-container-lowest rounded-lg py-2 px-3 text-sm border border-outline-variant/20 focus:ring-2 focus:ring-primary/20 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full bg-surface-container-lowest rounded-lg py-2 px-3 text-sm border border-outline-variant/20 focus:ring-2 focus:ring-primary/20 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="w-full bg-surface-container-lowest rounded-lg py-2 px-3 text-sm border border-outline-variant/20 focus:ring-2 focus:ring-primary/20 outline-none"
                        placeholder="Leave blank to keep current"
                        minLength={6}
                        autoComplete="new-password"
                      />
                    </div>
                    {editPassword && (
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                          Confirm Password
                        </label>
                        <input
                          type="password"
                          value={editConfirmPassword}
                          onChange={(e) => setEditConfirmPassword(e.target.value)}
                          className="w-full bg-surface-container-lowest rounded-lg py-2 px-3 text-sm border border-outline-variant/20 focus:ring-2 focus:ring-primary/20 outline-none"
                          required
                          minLength={6}
                          autoComplete="new-password"
                        />
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        disabled={isPending}
                        className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg disabled:opacity-50"
                      >
                        {isPending ? 'Saving...' : 'Save Credentials'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-4 border-t border-outline-variant/15">
        <h3 className="text-sm font-bold text-on-surface mb-4">Add staff user</h3>
        <form onSubmit={handleCreate} className="space-y-3">
          {createMessage && (
            <p
              className={`text-sm font-medium ${
                createMessage.includes('created') ? 'text-green-400' : 'text-error'
              }`}
            >
              {createMessage}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder="Full name"
              className="px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant/20 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
              required
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email"
              className="px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant/20 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
              required
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Password"
              className="px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant/20 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
              required
              minLength={6}
              autoComplete="new-password"
            />
            <input
              type="password"
              value={newConfirmPassword}
              onChange={(e) => setNewConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant/20 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 clinical-gradient text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {isPending ? 'Creating...' : 'Add User'}
          </button>
        </form>
      </div>
    </div>
  );
}
