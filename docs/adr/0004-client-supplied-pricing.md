# 0004 — Client supplies all order prices; server does not recompute them

**Status:** Accepted  
**Confidence:** HIGH — directly observable in `backend/controllers/orderController.js`

## Context

When a user places an order, the final totals (items, tax, shipping, grand total) need to be persisted. A choice had to be made: should the server recompute prices from product records, or trust the values sent by the client?

## Decision

The client computes all prices and sends them as part of the request body. The server blindly persists what it receives.

Observable in `orderController.js` — `addOrderItems`:
```js
const { orderItems, shippingAddress, paymentMethod,
        itemsPrice, taxPrice, shippingPrice, totalPrice } = req.body

const order = new Order({ orderItems, ..., itemsPrice, taxPrice, shippingPrice, totalPrice })
```

The `orderItems` array also carries client-supplied `price` per item. The controller never calls `Product.findById()` to verify prices or stock. PayPal payment confirmation is similarly accepted verbatim from the client body in `updateOrderToPaid` — no server-to-server verification against the PayPal API is performed.

## Alternatives Considered

- **Server-side price recomputation** — re-fetching each `Product` by ID and recalculating totals before saving. No such code exists in the controller.
- **PayPal server-side capture** (`/v2/checkout/orders/{id}/capture`) — would verify payment actually cleared. The PayPal Node SDK is absent from `package.json`; only the frontend `react-paypal-button-v2` is used.

## Consequences

**+** Controller is trivially simple — no price logic duplicated between client and server.  
**+** Frontend can display live totals without a round-trip to confirm them.  
**−** A client can submit `totalPrice: 0.01` with `paymentResult.status: "COMPLETED"` and the order will be saved and marked paid — there is no economic integrity check.  
**−** `countInStock` is never decremented on order creation; concurrent buyers can oversell any product.
