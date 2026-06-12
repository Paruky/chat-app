const { createClient } = require("@supabase/supabase-js");

function createSupabaseClient(config) {
    return createClient(config.supabaseUrl, config.supabaseKey);
}

module.exports = {
    createSupabaseClient
};
