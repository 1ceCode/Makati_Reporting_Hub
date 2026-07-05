// Centralized Supabase Database & Auth Engine

const SUPABASE_URL = 'https://ntbjaofhajysvfekvjqy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50Ymphb2ZoYWp5c3ZmZWt2anF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTc1NDgsImV4cCI6MjA5ODIzMzU0OH0.8J5fgummw2n-eYQtcZj31RnlDdyCP1wbhUJ8XYpkkKs';

// Initialize client safely
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const SESSION_KEY = 'mrh_current_user';

function getCurrentUser() {
    const u = localStorage.getItem(SESSION_KEY);
    return u ? JSON.parse(u) : null;
}

function setCurrentUser(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
}

async function login(username, password) {
    if (!supabaseClient) return false;
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password);

        if (error || !data || data.length === 0) {
            console.error('Login error:', error);
            return false;
        }

        const u = data[0];
        const userObj = {
            id: u.id,
            firstName: u.first_name,
            lastName: u.last_name,
            username: u.username,
            email: u.email,
            mobile: u.mobile,
            role: u.role
        };

        setCurrentUser(userObj);

        if (userObj.role === 'admin') {
            window.location.href = 'admin_dashboard.html';
        } else {
            window.location.href = 'dashboard.html';
        }
        return true;
    } catch (err) {
        console.error('Login exception:', err);
        return false;
    }
}

async function signup(formData) {
    if (!supabaseClient) {
        return { success: false, message: 'Supabase library failed to load in browser.' };
    }
    try {
        // Check duplicates safely
        const { data: uCheck, error: uErr } = await supabaseClient
            .from('users')
            .select('id')
            .eq('username', formData.username);

        if (uErr) {
            console.error('Table check error:', uErr);
            return { success: false, message: 'Database error: Did you create the "users" table in Supabase SQL Editor?' };
        }

        if (uCheck && uCheck.length > 0) {
            return { success: false, message: 'Username is already taken.' };
        }

        const { data: eCheck } = await supabaseClient
            .from('users')
            .select('id')
            .eq('email', formData.email);

        if (eCheck && eCheck.length > 0) {
            return { success: false, message: 'Email address is already registered.' };
        }

        // Determine role based on secret code
        const assignedRole = (formData.adminCode && formData.adminCode.trim().toUpperCase() === 'MAKATI-ADMIN') ? 'admin' : 'user';

        // Insert new user
        const { data, error } = await supabaseClient
            .from('users')
            .insert([{
                first_name: formData.firstName,
                last_name: formData.lastName,
                username: formData.username,
                email: formData.email,
                mobile: formData.mobile,
                password: formData.password,
                role: assignedRole
            }])
            .select();

        if (error || !data || data.length === 0) {
            console.error('Insert error:', error);
            return { success: false, message: `Failed to save account: ${error ? error.message : 'Unknown error'}` };
        }

        const u = data[0];
        const userObj = {
            id: u.id,
            firstName: u.first_name,
            lastName: u.last_name,
            username: u.username,
            email: u.email,
            mobile: u.mobile,
            role: u.role
        };

        setCurrentUser(userObj);
        if (userObj.role === 'admin') {
            window.location.href = 'admin_dashboard.html';
        } else {
            window.location.href = 'dashboard.html';
        }
        return { success: true };
    } catch (err) {
        console.error('Signup exception:', err);
        return { success: false, message: 'An unexpected error occurred while connecting to Supabase.' };
    }
}

async function createReport(reportData, imageFile, callback) {
    const user = getCurrentUser();
    if (!user || !supabaseClient) {
        callback({ success: false });
        return;
    }

    const processSave = async (base64Img) => {
        try {
            const { error } = await supabaseClient
                .from('reports')
                .insert([{
                    user_id: user.id,
                    citizen_name: `${user.firstName} ${user.lastName}`,
                    citizen_contact: user.mobile || user.email,
                    issue_type: reportData.issueType,
                    location: reportData.location,
                    description: reportData.description,
                    image: base64Img || null,
                    status: 'Pending',
                    date: new Date().toISOString().split('T')[0],
                    admin_feedback: ''
                }]);

            if (error) {
                console.error('Report save error:', error);
                callback({ success: false });
            } else {
                callback({ success: true });
            }
        } catch (err) {
            console.error('Report save exception:', err);
            callback({ success: false });
        }
    };

    if (imageFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            processSave(e.target.result);
        };
        reader.readAsDataURL(imageFile);
    } else {
        processSave(null);
    }
}

async function getReports(userId = null) {
    if (!supabaseClient) return [];
    try {
        let query = supabaseClient.from('reports').select('*').order('created_at', { ascending: false });
        if (userId) {
            query = query.eq('user_id', userId);
        }
        const { data, error } = await query;
        if (error) {
            console.error('Get reports error:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('Get reports exception:', err);
        return [];
    }
}

async function updateReportStatus(reportId, newStatus) {
    if (!supabaseClient) return false;
    try {
        const { error } = await supabaseClient
            .from('reports')
            .update({ status: newStatus })
            .eq('id', reportId);

        if (error) console.error('Status update error:', error);
        return !error;
    } catch (err) {
        console.error('Status update exception:', err);
        return false;
    }
}

async function updateReportFeedback(reportId, feedbackText) {
    if (!supabaseClient) return false;
    try {
        const { error } = await supabaseClient
            .from('reports')
            .update({ admin_feedback: feedbackText })
            .eq('id', reportId);

        if (error) console.error('Feedback update error:', error);
        return !error;
    } catch (err) {
        console.error('Feedback update exception:', err);
        return false;
    }
}
