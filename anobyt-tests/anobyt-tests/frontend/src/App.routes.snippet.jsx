// 1) In src/main.jsx wrap your app:  <AuthProvider><App /></AuthProvider>
//      import { AuthProvider } from './lib/auth';
// 2) In your router (src/App.jsx) add these routes next to your existing ones:
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TestRunner from './pages/TestRunner';
import Leaderboard from './pages/Leaderboard';

<Route path="/login" element={<Login />} />
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/test/:testId" element={<TestRunner />} />
<Route path="/leaderboard/:testId" element={<Leaderboard />} />

// 3) Add a navbar link:  <Link to="/dashboard">Coding Tests</Link>
// 4) Netlify -> Site settings -> Environment variables:  VITE_API_URL = <ApiUrl from sam deploy>
