# FINDINGS — proshop_mern

| # | Риск | Где | Что | Как фиксить | Статус |
|---|------|-----|-----|-------------|--------|
| 1 | 🔴 | `frontend/src/screens/PlaceOrderScreen.js` :: JSX disabled prop | `cart.cartItems === 0` сравнивает массив с числом — всегда `false`, кнопка Place Order никогда не блокируется, пустая корзина уходит в заказ | заменить на `cart.cartItems.length === 0` | ✅ fixed in commit 048e3b7 |
| 2 | 🔴 | `backend/controllers/orderController.js` :: `updateOrderToPaid` | `req.body.payer.email_address` без проверки на null — если PayPal вернёт другую структуру, сервер падает | добавить guard `req.body.payer?.email_address` | 🔴 not yet |
| 3 | 🟡 | `frontend/src/screens/OrderScreen.js` :: `successPaymentHandler` | `console.log(paymentResult)` в проде логирует имя, email и ID транзакции плательщика в консоль браузера | удалить `console.log` | 🔴 not yet |
| 4 | 🟡 | `package.json` (backend) | mongoose `5.10.6` — 4 major версии позади; метод `.remove()` удалён в Mongoose 6+ и уже используется в контроллерах | upgrade до v8, заменить `.remove()` на `deleteOne()` | 🔴 not yet |
| 5 | 🟡 | `package.json` (frontend) | react `16.x`, react-router-dom `5.x`, axios `0.20` — у axios известная CSRF-уязвимость в версиях до `1.x` | сначала поднять axios до `^1.x`, затем отдельно React 18 и Router 6 | 🔴 not yet |
