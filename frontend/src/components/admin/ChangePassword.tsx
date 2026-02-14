import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { profileApi } from '@/api/admin';

const ChangePassword: React.FC = () => {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwords_no_match'));
      return;
    }
    if (newPassword.length < 6) {
      setError(t('auth.password_min_length'));
      return;
    }

    setLoading(true);
    try {
      await profileApi.changePassword(currentPassword, newPassword);
      setMessage(t('auth.password_changed'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setError(e.response?.data?.message || t('auth.password_change_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password">
      <h3>{t('auth.change_password')}</h3>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>{t('auth.current_password')}</label>
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>{t('auth.new_password')}</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div className="form-group">
          <label>{t('auth.confirm_password')}</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? t('auth.changing') : t('auth.change_password')}
        </button>
      </form>
    </div>
  );
};

export default ChangePassword;
