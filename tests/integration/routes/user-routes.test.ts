import request from 'supertest'
import express from 'express'
import { usersRouter } from '../../../src/routes/users-route'
import { UsersModel } from '../../../src/models/users-model'

const app = express()
app.use(express.json())
app.use('/users', usersRouter)

jest.mock('../../../src/db/config', () => ({
  db: {
    query: jest.fn()
  }
}))

describe('GET /users', () => {
  it('should return all users', async () => {
    const mockUsers = [{ id: 1, name: 'John Doe', age: 24 }]
    jest.spyOn(UsersModel.prototype, 'getAll').mockResolvedValue(mockUsers)

    const response = await request(app).get('/users')

    expect(response.status).toBe(200)
    expect(response.body).toEqual(mockUsers)
  })
})
