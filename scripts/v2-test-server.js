'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.v2') });

if (!process.env.V2_MONGO_URI) {
  console.error('V2_MONGO_URI is required in .env.v2. The V2 test server never falls back to the live database.');
  process.exit(1);
}

process.env.MONGO_URI = process.env.V2_MONGO_URI;
process.env.PORT = process.env.PORT || process.env.V2_TEST_PORT || '5001';
process.env.V2_TEST_MODE = 'true';

require('../server');
