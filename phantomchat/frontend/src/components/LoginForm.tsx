/**
 * PhantomChat Login Form component.
 *
 * Handles both registration and login flows with decoy password support.
 * The same form is used for both real and decoy passwords — the UI gives
 * no indication of which type of account is being accessed.
 */

import { useState, type FormEvent } from 'react';
import { evaluatePasswordStrength, type PasswordStrength } from '../crypto/argon2-wrapper';

export interface LoginFormProps {
  onLogin: (password: string) => Promise<void>;
  onRegister: (realPassword: string, decoyPassword: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

function StrengthIndicator({ strength }: { strength: PasswordStrength }) {
  const colors: Record<PasswordStrength['label'], string> = {
    weak: 'bg-red-500',
    fair: 'bg-orange-500',
    good: 'bg-yellow-500',
    strong: 'bg-green-500',
    excellent: 'bg-emerald-400',
  };

  return (
    <div className="mt-1">
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < strength.score ? colors[strength.label] : 'bg-zinc-700'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-zinc-500 mt-1">
        Password strength: <span className="text-zinc-300">{strength.label}</span>
      </p>
    </div>
  );
}

export function LoginForm({ onLogin, onRegister, isLoading, error }: LoginFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [password, setPassword] = useState('');
  const [decoyPassword, setDecoyPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const passwordStrength = evaluatePasswordStrength(password);
  const decoyStrength = evaluatePasswordStrength(decoyPassword);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (mode === 'login') {
      if (!password) {
        setLocalError('Password is required');
        return;
      }
      await onLogin(password);
    } else {
      if (!password || !decoyPassword) {
        setLocalError('Both passwords are required');
        return;
      }
      if (password === decoyPassword) {
        setLocalError('Real and decoy passwords must be different');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }
      if (passwordStrength.score < 3) {
        setLocalError('Password is too weak. Use at least 12 characters with mixed case, digits, and symbols.');
        return;
      }
      await onRegister(password, decoyPassword);
    }
  };

  const displayError = error ?? localError;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">
            PhantomChat
          </h1>
          <p className="text-zinc-500 text-sm mt-2">
            End-to-end encrypted messaging
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex mb-6 bg-zinc-900 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'login'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'register'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-400 mb-1"
            >
              {mode === 'register' ? 'Main Password' : 'Password'}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:border-transparent"
              placeholder="Enter your password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              disabled={isLoading}
            />
            {mode === 'register' && password.length > 0 && (
              <StrengthIndicator strength={passwordStrength} />
            )}
          </div>

          {/* Confirm Password (register only) */}
          {mode === 'register' && (
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-zinc-400 mb-1"
              >
                Confirm Main Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:border-transparent"
                placeholder="Confirm your password"
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>
          )}

          {/* Decoy Password (register only) */}
          {mode === 'register' && (
            <div>
              <label
                htmlFor="decoy-password"
                className="block text-sm font-medium text-zinc-400 mb-1"
              >
                Decoy Password
              </label>
              <p className="text-xs text-zinc-600 mb-2">
                This password opens a separate decoy account. Use it if forced to reveal a password.
              </p>
              <input
                id="decoy-password"
                type="password"
                value={decoyPassword}
                onChange={(e) => setDecoyPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:border-transparent"
                placeholder="Enter decoy password"
                autoComplete="new-password"
                disabled={isLoading}
              />
              {decoyPassword.length > 0 && (
                <StrengthIndicator strength={decoyStrength} />
              )}
            </div>
          )}

          {/* Error Display */}
          {displayError && (
            <div className="bg-red-950/50 border border-red-900 rounded-lg px-4 py-3 text-sm text-red-400">
              {displayError}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-zinc-100 text-zinc-900 font-medium py-2.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {mode === 'register' ? 'Generating keys...' : 'Deriving key...'}
              </span>
            ) : mode === 'register' ? (
              'Create Account'
            ) : (
              'Unlock'
            )}
          </button>
        </form>

        {/* Security Notice */}
        <p className="text-xs text-zinc-600 text-center mt-6">
          Keys are generated locally in your browser. Your password never leaves this device.
        </p>
      </div>
    </div>
  );
}
