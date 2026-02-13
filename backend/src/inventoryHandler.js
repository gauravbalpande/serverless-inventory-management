const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

const {
  SHOPS_TABLE,
  PRODUCTS_TABLE,
  TRANSACTIONS_TABLE,
  LOW_STOCK_TOPIC_ARN
} = process.env;

// Utility: standard JSON response
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return response(200, { ok: true });
    }

    const path = event.resource || event.path;
    const method = event.httpMethod;
    const shopId = event.pathParameters ? event.pathParameters.shopId : null;
    const productId = event.pathParameters ? event.pathParameters.productId : null;

    if (!shopId) {
      return response(400, { message: 'shopId is required in path' });
    }

    // Route based on resource + method
    if (path === '/shops/{shopId}/products' && method === 'GET') {
      return await listProducts(shopId, event);
    }
    if (path === '/shops/{shopId}/products' && method === 'POST') {
      return await createProduct(shopId, event);
    }
    if (path === '/shops/{shopId}/products/{productId}' && method === 'PUT') {
      return await updateProduct(shopId, productId, event);
    }
    if (path === '/shops/{shopId}/products/{productId}' && method === 'DELETE') {
      return await deleteProduct(shopId, productId);
    }
    if (path === '/shops/{shopId}/products/{productId}/adjust-stock' && method === 'POST') {
      return await adjustStock(shopId, productId, event);
    }
    if (path === '/shops/{shopId}/products/{productId}/transactions' && method === 'GET') {
      return await listTransactions(shopId, productId, event);
    }

    return response(404, { message: 'Not Found' });
  } catch (err) {
    console.error('Error in handler', err);
    return response(500, { message: 'Internal server error', error: err.message });
  }
};

async function listProducts(shopId, event) {
  const params = {
    TableName: PRODUCTS_TABLE,
    KeyConditionExpression: 'shopId = :shopId',
    ExpressionAttributeValues: {
      ':shopId': shopId
    }
  };

  const data = await dynamo.query(params).promise();
  return response(200, { items: data.Items || [] });
}

async function createProduct(shopId, event) {
  const body = safeJsonParse(event.body);
  if (!body || !body.name) {
    return response(400, { message: 'Product name is required' });
  }

  const now = new Date().toISOString();
  const productId = body.productId || uuidv4();

  const item = {
    shopId,
    productId,
    name: body.name,
    sku: body.sku || productId,
    category: body.category || 'Uncategorized',
    unit: body.unit || 'pcs',
    reorderThreshold: typeof body.reorderThreshold === 'number' ? body.reorderThreshold : 10,
    currentStock: typeof body.currentStock === 'number' ? body.currentStock : 0,
    createdAt: now,
    updatedAt: now
  };

  await dynamo
    .put({
      TableName: PRODUCTS_TABLE,
      Item: item,
      ConditionExpression: 'attribute_not_exists(shopId) AND attribute_not_exists(productId)'
    })
    .promise()
    .catch((err) => {
      if (err.code === 'ConditionalCheckFailedException') {
        return Promise.reject(new Error('Product with this ID already exists'));
      }
      return Promise.reject(err);
    });

  return response(201, item);
}

async function updateProduct(shopId, productId, event) {
  const body = safeJsonParse(event.body) || {};
  const now = new Date().toISOString();

  const fields = ['name', 'sku', 'category', 'unit', 'reorderThreshold'];
  const expressionParts = [];
  const values = { ':updatedAt': now };
  const names = { '#updatedAt': 'updatedAt' };

  for (const field of fields) {
    if (body[field] !== undefined) {
      expressionParts.push(`#${field} = :${field}`);
      names[`#${field}`] = field;
      values[`:${field}`] = body[field];
    }
  }

  if (expressionParts.length === 0) {
    return response(400, { message: 'No updatable fields provided' });
  }

  expressionParts.push('#updatedAt = :updatedAt');

  const params = {
    TableName: PRODUCTS_TABLE,
    Key: { shopId, productId },
    UpdateExpression: 'SET ' + expressionParts.join(', '),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamo.update(params).promise();
  return response(200, result.Attributes);
}

async function deleteProduct(shopId, productId) {
  const params = {
    TableName: PRODUCTS_TABLE,
    Key: { shopId, productId }
  };
  await dynamo.delete(params).promise();
  return response(204, {});
}

async function adjustStock(shopId, productId, event) {
  const body = safeJsonParse(event.body);
  if (!body || typeof body.quantity !== 'number') {
    return response(400, { message: 'quantity (number) is required' });
  }

  const quantity = body.quantity; // negative for sale, positive for restock
  const note = body.note || null;
  const now = new Date().toISOString();

  // Load current product
  const getResult = await dynamo
    .get({
      TableName: PRODUCTS_TABLE,
      Key: { shopId, productId }
    })
    .promise();

  const product = getResult.Item;
  if (!product) {
    return response(404, { message: 'Product not found' });
  }

  const oldStock = product.currentStock || 0;
  const newStock = oldStock + quantity;

  // Update stock
  const updateParams = {
    TableName: PRODUCTS_TABLE,
    Key: { shopId, productId },
    UpdateExpression: 'SET currentStock = :newStock, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':newStock': newStock,
      ':updatedAt': now
    },
    ReturnValues: 'ALL_NEW'
  };
  const updateResult = await dynamo.update(updateParams).promise();

  // Record transaction
  const transactionId = `${Date.now()}#${productId}`;
  const type = quantity < 0 ? 'SALE' : quantity > 0 ? 'RESTOCK' : 'ADJUSTMENT';

  const txItem = {
    shopId,
    transactionId,
    productId,
    type,
    quantity,
    balanceAfter: newStock,
    note,
    createdAt: now
  };

  await dynamo
    .put({
      TableName: TRANSACTIONS_TABLE,
      Item: txItem
    })
    .promise();

  // Low-stock SNS alert
  try {
    if (typeof product.reorderThreshold === 'number' && newStock <= product.reorderThreshold && LOW_STOCK_TOPIC_ARN) {
      const message = `Low stock alert for ${product.name} (SKU: ${product.sku}) in shop ${shopId}.\n` +
        `Current stock: ${newStock}\n` +
        `Reorder threshold: ${product.reorderThreshold}`;

      await sns
        .publish({
          TopicArn: LOW_STOCK_TOPIC_ARN,
          Subject: `Low stock alert: ${product.name}`,
          Message: message
        })
        .promise();
    }
  } catch (snsErr) {
    console.error('Failed to publish low-stock SNS message', snsErr);
    // Do not fail the main request if alerting fails
  }

  return response(200, {
    product: updateResult.Attributes,
    transaction: txItem
  });
}

async function listTransactions(shopId, productId, event) {
  const limit = event.queryStringParameters && event.queryStringParameters.limit
    ? Number(event.queryStringParameters.limit)
    : 50;

  const params = {
    TableName: TRANSACTIONS_TABLE,
    KeyConditionExpression: 'shopId = :shopId',
    ExpressionAttributeValues: {
      ':shopId': shopId
    },
    ScanIndexForward: false, // newest first if using timestamp prefix
    Limit: limit
  };

  const data = await dynamo.query(params).promise();
  const items = (data.Items || []).filter((tx) => tx.productId === productId);
  return response(200, { items });
}

function safeJsonParse(body) {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

