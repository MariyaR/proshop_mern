/**
 * Characterization tests for createProductReview
 * Captures CURRENT behavior — including bugs. Do not "fix" these tests.
 *
 * Setup (backend has "type":"module" so Jest needs ESM mode):
 *   npm install --save-dev jest
 *   Run: NODE_OPTIONS=--experimental-vm-modules npx jest backend/__tests__/createProductReview.test.js
 */

import { jest } from '@jest/globals'

jest.mock('../models/productModel.js', () => ({
  default: { findById: jest.fn() },
}))

import Product from '../models/productModel.js'
import { createProductReview } from '../controllers/productController.js'

// ─── helpers ────────────────────────────────────────────────────────────────

const makeReq = (overrides = {}) => ({
  params: { id: 'product-abc' },
  body: { rating: 4, comment: 'Solid product' },
  user: { _id: 'user-1', name: 'Alice' },
  ...overrides,
})

const makeRes = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

const makeMockProduct = (existingReviews = []) => ({
  reviews: [...existingReviews],
  numReviews: existingReviews.length,
  rating: 0,
  save: jest.fn().mockResolvedValue(undefined),
})

// user ref inside a stored review — needs .toString() to match the middleware
const userRef = (id) => ({ toString: () => id })

// ─── tests ───────────────────────────────────────────────────────────────────

describe('createProductReview — characterization tests', () => {
  let res, next

  beforeEach(() => {
    jest.clearAllMocks()
    res = makeRes()
    next = jest.fn()
  })

  // ── happy path ─────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('responds with 201 and { message: "Review added" }', async () => {
      const product = makeMockProduct()
      Product.findById.mockResolvedValue(product)

      await createProductReview(makeReq(), res, next)

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ message: 'Review added' })
      expect(next).not.toHaveBeenCalled()
    })

    it('pushes a review with correct shape into product.reviews', async () => {
      const product = makeMockProduct()
      Product.findById.mockResolvedValue(product)

      await createProductReview(
        makeReq({ body: { rating: 5, comment: 'Perfect' }, user: { _id: 'u1', name: 'Bob' } }),
        res,
        next
      )

      expect(product.reviews).toHaveLength(1)
      expect(product.reviews[0]).toMatchObject({
        name: 'Bob',
        rating: 5,
        comment: 'Perfect',
        user: 'u1',
      })
    })

    it('sets numReviews to 1 after first review', async () => {
      const product = makeMockProduct()
      Product.findById.mockResolvedValue(product)

      await createProductReview(makeReq(), res, next)

      expect(product.numReviews).toBe(1)
    })

    it('sets product.rating equal to the single review rating', async () => {
      const product = makeMockProduct()
      Product.findById.mockResolvedValue(product)

      await createProductReview(makeReq({ body: { rating: 3, comment: 'Ok' } }), res, next)

      expect(product.rating).toBe(3)
    })

    it('recalculates average rating when existing reviews are present', async () => {
      // existing review: rating 4, new review: rating 2 → avg = 3
      const product = makeMockProduct([{ rating: 4, user: userRef('other-user') }])
      Product.findById.mockResolvedValue(product)

      await createProductReview(
        makeReq({ body: { rating: 2, comment: 'Below average' }, user: { _id: 'user-1', name: 'Alice' } }),
        res,
        next
      )

      expect(product.rating).toBe(3)
      expect(product.numReviews).toBe(2)
    })

    it('calls product.save()', async () => {
      const product = makeMockProduct()
      Product.findById.mockResolvedValue(product)

      await createProductReview(makeReq(), res, next)

      expect(product.save).toHaveBeenCalledTimes(1)
    })

    it('casts a numeric-string rating to a number', async () => {
      const product = makeMockProduct()
      Product.findById.mockResolvedValue(product)

      await createProductReview(
        makeReq({ body: { rating: '4', comment: 'Fine' } }),
        res,
        next
      )

      expect(typeof product.reviews[0].rating).toBe('number')
      expect(product.reviews[0].rating).toBe(4)
    })
  })

  // ── product not found ──────────────────────────────────────────────────────

  describe('product not found', () => {
    it('sets status 404 and passes "Product not found" error to next', async () => {
      Product.findById.mockResolvedValue(null)

      await createProductReview(makeReq(), res, next)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Product not found' })
      )
    })

    it('does not call res.json when product is null', async () => {
      Product.findById.mockResolvedValue(null)

      await createProductReview(makeReq(), res, next)

      expect(res.json).not.toHaveBeenCalled()
    })
  })

  // ── already reviewed ───────────────────────────────────────────────────────

  describe('already reviewed', () => {
    it('sets status 400 and passes "Product already reviewed" to next', async () => {
      const product = makeMockProduct([{ rating: 4, user: userRef('user-1') }])
      Product.findById.mockResolvedValue(product)

      await createProductReview(
        makeReq({ user: { _id: 'user-1', name: 'Alice' } }),
        res,
        next
      )

      expect(res.status).toHaveBeenCalledWith(400)
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Product already reviewed' })
      )
    })

    it('does not push a second review into product.reviews', async () => {
      const product = makeMockProduct([{ rating: 4, user: userRef('user-1') }])
      Product.findById.mockResolvedValue(product)

      await createProductReview(
        makeReq({ user: { _id: 'user-1', name: 'Alice' } }),
        res,
        next
      )

      expect(product.reviews).toHaveLength(1)
    })

    it('does not call product.save() when duplicate review detected', async () => {
      const product = makeMockProduct([{ rating: 4, user: userRef('user-1') }])
      Product.findById.mockResolvedValue(product)

      await createProductReview(
        makeReq({ user: { _id: 'user-1', name: 'Alice' } }),
        res,
        next
      )

      expect(product.save).not.toHaveBeenCalled()
    })
  })

  // ── buggy behaviors — do not fix ───────────────────────────────────────────

  describe('buggy behaviors', () => {
    it('stores NaN as rating and corrupts product.rating when rating is undefined', async () => {
      // This asserts current buggy behavior.
      // Correct would be: reject with 400 "Rating is required"
      const product = makeMockProduct()
      Product.findById.mockResolvedValue(product)

      await createProductReview(
        makeReq({ body: { comment: 'Forgot the rating' } }),
        res,
        next
      )

      expect(product.reviews[0].rating).toBeNaN()
      expect(product.rating).toBeNaN()
      expect(res.status).toHaveBeenCalledWith(201) // still succeeds
    })

    it('stores NaN as rating when rating is a non-numeric string', async () => {
      // This asserts current buggy behavior.
      // Correct would be: reject with 400 "Rating must be a number between 1 and 5"
      const product = makeMockProduct()
      Product.findById.mockResolvedValue(product)

      await createProductReview(
        makeReq({ body: { rating: 'five', comment: 'Great' } }),
        res,
        next
      )

      expect(product.reviews[0].rating).toBeNaN()
      expect(product.rating).toBeNaN()
    })

    it('accepts and stores out-of-range rating (-1) without any error', async () => {
      // This asserts current buggy behavior.
      // Correct would be: reject with 400 "Rating must be between 1 and 5"
      const product = makeMockProduct()
      Product.findById.mockResolvedValue(product)

      await createProductReview(
        makeReq({ body: { rating: -1, comment: 'Terrible' } }),
        res,
        next
      )

      expect(product.reviews[0].rating).toBe(-1)
      expect(product.rating).toBe(-1)
      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('accepts and stores rating of 999 without any error', async () => {
      const product = makeMockProduct()
      Product.findById.mockResolvedValue(product)

      await createProductReview(
        makeReq({ body: { rating: 999, comment: 'Off the charts' } }),
        res,
        next
      )

      expect(product.reviews[0].rating).toBe(999)
      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('stores undefined as comment when comment is omitted', async () => {
      const product = makeMockProduct()
      Product.findById.mockResolvedValue(product)

      await createProductReview(
        makeReq({ body: { rating: 3 } }),
        res,
        next
      )

      expect(product.reviews[0].comment).toBeUndefined()
      expect(res.status).toHaveBeenCalledWith(201)
    })
  })
})
