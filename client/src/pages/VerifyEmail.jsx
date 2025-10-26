import { useState, useEffect, useRef, useContext } from 'react';
import { CheckCircle, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const VerifyEmail = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [timer, setTimer] = useState(600);
  const [canResend, setCanResend] = useState(false);
  const { axios } = useContext(AuthContext); 
  
  const inputRefs = useRef([]);

  useEffect(() => {
    if (isOtpSent && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isOtpSent, timer]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendOtp = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    if(!email){
        toast.error("Email should be provided");
        return ;
    }

    try {

      const { data } = await axios.post('/api/otp/send-verification-otp', {
        email
      });

      if (data.success) {
        setIsOtpSent(true);
        setTimer(600);
        setCanResend(false);
        setMessage({ type: 'success', text: data.message });
        setTimeout(() => inputRefs.current[0]?.focus(), 100);

      } else {
        setMessage({ type: 'error', text: data.message });
        toast.error("Otp not send, try again later");
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send OTP. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split('').forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);
    inputRefs.current[Math.min(pastedData.length, 5)]?.focus();
  };

  const handleVerifyOtp = async () => {
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      setMessage({ type: 'error', text: 'Please enter all 6 digits' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/otp/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpString }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.message });
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to verify OTP. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setOtp(['', '', '', '', '', '']);
    setMessage({ type: '', text: '' });
    handleSendOtp();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20"></div>
      
      <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '700ms'}}></div>

      <div className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md transform transition-all duration-500 hover:scale-[1.02]">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4 animate-bounce">
            <Mail className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Verify Your Email</h1>
          <p className="text-gray-600">Join ChatConnect and start connecting!</p>
        </div>

        {!isOtpSent ? (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>

            <button
              onClick={handleSendOtp}
              disabled={loading || !email}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Send OTP <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <p className="text-gray-600 mb-2">
                We sent a code to
              </p>
              <p className="font-semibold text-gray-800">{email}</p>
              <div className="mt-4 inline-flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-indigo-600">
                  {formatTime(timer)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                Enter 6-Digit Code
              </label>
              <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Verify Email <CheckCircle className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="text-center">
              <button
                onClick={handleResend}
                disabled={!canResend || loading}
                className="text-indigo-600 hover:text-indigo-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {canResend ? 'Resend OTP' : 'Resend available after timer expires'}
              </button>
            </div>
          </div>
        )}

        {message.text && (
          <div
            className={`mt-6 p-4 rounded-xl flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm">{message.text}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;