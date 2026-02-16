#!/usr/bin/env node
/**
 * Add shop entries to the Shops DynamoDB table using AWS CLI.
 * Usage:
 *   STACK_NAME=cloud-inventory-backend ./scripts/add-shops.js
 *   STACK_NAME=cloud-inventory-backend ./scripts/add-shops.js scripts/shops.json
 *
 * Default shops are written if no JSON file is provided.
 * Requires: AWS CLI configured (aws configure).
 */

const fs = require('fs');
const { execSync } = require('child_process');

const stackName = process.env.STACK_NAME || process.env.SAM_STACK_NAME || 'cloud-inventory-backend';
const region = process.env.AWS_REGION || 'us-east-1';
const tableName = `${stackName}-Shops`;

const defaultShops = [
  { shopId: 'demo-shop-001', name: 'Demo Shop · Small', ownerEmail: 'owner@example.com', size: 'small' },
  { shopId: 'demo-shop-002', name: 'Demo Shop · Medium', ownerEmail: 'owner@example.com', size: 'medium' },
  { shopId: 'demo-shop-003', name: 'Demo Shop · Multi-branch', ownerEmail: 'owner@example.com', size: 'large' }
];

function getShops() {
  const file = process.argv[2];
  if (file && fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return defaultShops;
}

function putItem(item) {
  const payload = {
    shopId: { S: String(item.shopId) },
    name: { S: String(item.name || item.shopId) },
    ownerEmail: { S: String(item.ownerEmail != null ? item.ownerEmail : 'unknown@example.com') },
    size: { S: ['small', 'medium', 'large'].includes(item.size) ? item.size : 'small' },
    createdAt: { S: item.createdAt || new Date().toISOString() }
  };
  execSync(
    ['aws', 'dynamodb', 'put-item', '--table-name', tableName, '--region', region, '--item', JSON.stringify(payload)],
    { stdio: 'inherit' }
  );
}

function main() {
  const shops = getShops();
  const items = Array.isArray(shops) ? shops : [shops];

  console.log('Table:', tableName, 'Region:', region);
  console.log('Shops to add:', items.length);

  for (const item of items) {
    putItem(item);
    console.log('  OK', item.shopId, item.name || item.shopId);
  }

  console.log('Done.');
}

main();
