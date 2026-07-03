import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useApp } from '../context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, ArrowRight, Shield, AlertTriangle, RefreshCw } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

function getPasswordStrength(password = '') {
  const checks = [
    { label: '8+ characters', passed: password.length >= 8 },
    { label: 'Uppercase', passed: /[A-Z]/.test(password) },
    { label: 'Lowercase', passed: /[a-z]/.test(password) },
    { label: 'Number', passed: /\d/.test(password) },
    { label: 'Symbol', passed: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((check) => check.passed).length;

  if (!password) {
    return {
      checks,
      score: 0,
      label: 'Start typing',
      color: 'bg-gray-200',
      textColor: 'text-gray-400',
    };
  }

  if (score <= 2) {
    return {
      checks,
      score,
      label: 'Weak',
      color: 'bg-rose-500',
      textColor: 'text-rose-600',
    };
  }

  if (score <= 4) {
    return {
      checks,
      score,
      label: 'Good',
      color: 'bg-amber-500',
      textColor: 'text-amber-600',
    };
  }

  return {
    checks,
    score,
    label: 'Strong',
    color: 'bg-emerald-500',
    textColor: 'text-emerald-600',
  };
}

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const { login, register, user, addToast } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [serverError, setServerError] = useState<string | null>(null);
  const [lockCountdown, setLockCountdown] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if redirect path is passed, or if user is already authenticated
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Handle location state to switch mode
  useEffect(() => {
    const state = location.state as { mode?: 'login' | 'register' };
    if (state?.mode) {
      setMode(state.mode);
    }
  }, [location.state]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockCountdown === null || lockCountdown <= 0) return;
    const interval = setInterval(() => {
      setLockCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setServerError(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockCountdown]);

  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors, isValid: isLoginValid },
    reset: resetLoginForm,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const {
    register: registerReg,
    handleSubmit: handleRegisterSubmit,
    formState: { errors: regErrors, isValid: isRegValid },
    reset: resetRegForm,
    watch: watchRegister,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
  });
  const watchedRegisterPassword = watchRegister('password') || '';
  const passwordStrength = getPasswordStrength(watchedRegisterPassword);

  const onLogin = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err: any) {
      const responseData = err.response?.data;
      if (err.response?.status === 423 && responseData?.lockUntil) {
        const remainingMs = new Date(responseData.lockUntil).getTime() - Date.now();
        setLockCountdown(Math.ceil(remainingMs / 1000));
        setServerError(responseData.error || responseData.message || 'Account is temporarily locked.');
      } else {
        setServerError(responseData?.error || responseData?.message || 'Invalid credentials. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRegister = async (data: RegisterFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await register(data.name, data.email, data.password);
      navigate('/dashboard');
    } catch (err: any) {
      const responseData = err.response?.data;
      setServerError(responseData?.error || responseData?.message || 'Registration failed. Please try a different email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setServerError(null);
    resetLoginForm();
    resetRegForm();
  };

  return (
    <div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center px-6 bg-[#FAFAF8] py-12">
      {/* 3D background grid texture */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(#000 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="w-full max-w-md relative z-10">
        
        {/* Floating 3D Textured Frame */}
        <div className="bg-white/95 rounded-3xl border border-gray-100 p-8 shadow-[0_20px_50px_rgba(38,70,83,0.06)] backdrop-blur-xl relative overflow-hidden transition-all duration-300">
          
          {/* Subtle warm ambient occlusion shadow inner border */}
          <div className="absolute inset-0 border border-black/[0.01] pointer-events-none rounded-3xl" />

          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-[#264653]/5 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-[#264653]" />
            </div>
            <h2 className="text-2xl font-bold font-serif text-gray-900 tracking-tight">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-sm text-gray-500 mt-1.5 text-center font-medium">
              {mode === 'login' 
                ? 'Sign in to access your 3D tactile notes workspace' 
                : 'Get started with defense-grade secure thought storage'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === 'login' ? -15 : 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === 'login' ? 15 : -15 }}
              transition={{ duration: 0.2 }}
            >
              {serverError && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-900 text-xs font-semibold flex items-start gap-2.5 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{serverError}</span>
                    {lockCountdown !== null && lockCountdown > 0 && (
                      <span className="block mt-1 font-mono text-rose-700 font-bold">
                        Lockout Timer: {lockCountdown}s
                      </span>
                    )}
                  </div>
                </div>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        {...registerLogin('email')}
                        className={`w-full pl-10 pr-4 py-3 bg-[#FAFAF8] rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#264653]/10 transition-all ${
                          loginErrors.email ? 'border-rose-300 focus:border-rose-400' : 'border-gray-200/80 focus:border-[#264653]'
                        }`}
                        placeholder="you@domain.com"
                        disabled={isSubmitting || lockCountdown !== null}
                      />
                    </div>
                    {loginErrors.email && (
                      <span className="text-[11px] text-rose-600 font-bold block pl-1 animate-fade-in">
                        {loginErrors.email.message}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        {...registerLogin('password')}
                        className={`w-full pl-10 pr-4 py-3 bg-[#FAFAF8] rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#264653]/10 transition-all ${
                          loginErrors.password ? 'border-rose-300 focus:border-rose-400' : 'border-gray-200/80 focus:border-[#264653]'
                        }`}
                        placeholder="••••••••"
                        disabled={isSubmitting || lockCountdown !== null}
                      />
                    </div>
                    {loginErrors.password && (
                      <span className="text-[11px] text-rose-600 font-bold block pl-1 animate-fade-in">
                        {loginErrors.password.message}
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={!isLoginValid || isSubmitting || lockCountdown !== null}
                    className="w-full py-3.5 mt-2 bg-[#264653] hover:bg-[#1a303a] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-[#264653]/5 hover:shadow-xl hover:scale-[1.005]"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Unseal Workspace
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit(onRegister)} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        {...registerReg('name')}
                        className={`w-full pl-10 pr-4 py-3 bg-[#FAFAF8] rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#264653]/10 transition-all ${
                          regErrors.name ? 'border-rose-300 focus:border-rose-400' : 'border-gray-200/80 focus:border-[#264653]'
                        }`}
                        placeholder="Your Name"
                        disabled={isSubmitting}
                      />
                    </div>
                    {regErrors.name && (
                      <span className="text-[11px] text-rose-600 font-bold block pl-1 animate-fade-in">
                        {regErrors.name.message}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        {...registerReg('email')}
                        className={`w-full pl-10 pr-4 py-3 bg-[#FAFAF8] rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#264653]/10 transition-all ${
                          regErrors.email ? 'border-rose-300 focus:border-rose-400' : 'border-gray-200/80 focus:border-[#264653]'
                        }`}
                        placeholder="you@domain.com"
                        disabled={isSubmitting}
                      />
                    </div>
                    {regErrors.email && (
                      <span className="text-[11px] text-rose-600 font-bold block pl-1 animate-fade-in">
                        {regErrors.email.message}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        {...registerReg('password')}
                        className={`w-full pl-10 pr-4 py-3 bg-[#FAFAF8] rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#264653]/10 transition-all ${
                          regErrors.password ? 'border-rose-300 focus:border-rose-400' : 'border-gray-200/80 focus:border-[#264653]'
                        }`}
                        placeholder="At least 6 characters"
                        disabled={isSubmitting}
                      />
                    </div>
                    {regErrors.password && (
                      <span className="text-[11px] text-rose-600 font-bold block pl-1 animate-fade-in">
                        {regErrors.password.message}
                      </span>
                    )}
                    <div className="pt-2 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                          Password Strength
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${passwordStrength.textColor}`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {passwordStrength.checks.map((check, index) => (
                          <div
                            key={check.label}
                            className={`h-1.5 rounded-full transition-colors ${
                              index < passwordStrength.score ? passwordStrength.color : 'bg-gray-100'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {passwordStrength.checks.map((check) => (
                          <span
                            key={check.label}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                              check.passed
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-gray-50 text-gray-400 border border-gray-100'
                            }`}
                          >
                            {check.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!isRegValid || isSubmitting}
                    className="w-full py-3.5 mt-2 bg-[#264653] hover:bg-[#1a303a] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-[#264653]/5 hover:shadow-xl hover:scale-[1.005]"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Initialize Vault
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center text-xs">
            <button
              onClick={toggleMode}
              className="font-bold text-[#264653] hover:text-[#1a303a] hover:underline flex items-center gap-1 transition-colors"
            >
              {mode === 'login' ? "Need a workspace? Register here" : 'Already configured? Login here'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
