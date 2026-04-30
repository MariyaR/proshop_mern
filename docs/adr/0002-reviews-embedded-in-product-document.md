# 0002 — Product reviews stored as embedded subdocuments

**Status:** Accepted  
**Confidence:** HIGH — directly observable in `backend/models/productModel.js`

## Context

The app supports user reviews on products (rating + comment). In MongoDB, related data can either live in its own collection (referenced by ObjectId) or be embedded directly inside the parent document as a subdocument array. A choice had to be made for the review data.

## Decision

Embed reviews as a subdocument array inside the `Product` document using a `reviewSchema`.

Observable in `productModel.js`:
```js
const reviewSchema = mongoose.Schema({ name, rating, comment, user, ... })
const productSchema = mongoose.Schema({
  ...
  reviews: [reviewSchema],
  rating: Number,
  numReviews: Number,
  ...
})
```

The aggregate `rating` and `numReviews` fields are also denormalised onto the product and recalculated on every new review write.

## Alternatives Considered

- **Separate `Review` collection** with a `product` reference — would allow querying all reviews by a user, paginating reviews independently, and keeping product documents small. Not implemented: there is no `reviewModel.js` file in the codebase.

## Consequences

**+** A single `Product.findById()` returns everything needed to render the product page — no join or second query required.  
**+** Atomic writes: adding a review and updating the product's aggregate rating happen in the same document save.  
**−** MongoDB documents have a 16 MB size limit. A product with thousands of reviews would approach this limit.  
**−** There is no way to query "all reviews left by a user" without scanning every product document.  
**−** The denormalised `rating` and `numReviews` fields can drift out of sync if a review write fails partway through.
