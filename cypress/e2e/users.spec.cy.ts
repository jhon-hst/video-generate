describe('API Test for /users endpoint', () => {
  it('should return a list of users with specific data', () => {
    // Realiza una petición GET al endpoint /users
    cy.request('GET', 'http://localhost:3000/users').then((response) => {
      // Verifica que la respuesta tenga el estado 200
      expect(response.status).to.eq(200)

      // Verifica que el body sea un array
      expect(response.body).to.be.an('array')

      // Verifica que el primer usuario tenga los datos esperados
      const user = response.body[0]
      expect(user).to.have.property('id', 1)
      expect(user).to.have.property('name', 'Jhon')
      expect(user).to.have.property('age', 28)
      expect(user).to.have.property('lastname', 'Sanchez')
    })
  })
})
