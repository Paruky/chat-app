const { createClient } = require("@supabase/supabase-js");

function createSupabaseClient(config) {
    return createClient(config.supabaseUrl, config.supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
}

module.exports = {
    createSupabaseClient
};
