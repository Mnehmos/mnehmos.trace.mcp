// Package models contains Gin router patterns
// This file tests Gin framework detection with path parameters
package models

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// GinUser for response examples
type GinUser struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// GinProduct for response examples
type GinProduct struct {
	SKU   string  `json:"sku"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

// SetupGinRouter demonstrates basic Gin router setup
func SetupGinRouter() *gin.Engine {
	router := gin.Default()

	// Basic routes with different HTTP methods
	router.GET("/", ginHomeHandler)
	router.GET("/health", ginHealthCheck)
	router.GET("/ping", func(c *gin.Context) {
		c.String(http.StatusOK, "pong")
	})

	// User routes with path parameters
	router.GET("/users", ginListUsers)
	router.POST("/users", ginCreateUser)
	router.GET("/users/:id", ginGetUser) // Gin uses :param syntax
	router.PUT("/users/:id", ginUpdateUser)
	router.DELETE("/users/:id", ginDeleteUser)
	router.PATCH("/users/:id", ginPatchUser)

	// Wildcard path parameter
	router.GET("/files/*filepath", ginServeFile) // Gin uses *param for wildcards

	// Multiple path parameters
	router.GET("/users/:userId/posts/:postId", ginGetUserPost)
	router.GET("/users/:userId/posts/:postId/comments/:commentId", ginGetUserPostComment)
	router.GET("/orgs/:orgId/teams/:teamId/members/:memberId", ginGetOrgTeamMember)

	// Product routes
	router.GET("/products", ginListProducts)
	router.POST("/products", ginCreateProduct)
	router.GET("/products/:sku", ginGetProduct)

	return router
}

// SetupGinRouteGroups demonstrates Gin route grouping
func SetupGinRouteGroups() *gin.Engine {
	router := gin.Default()

	// Route groups with Group()
	api := router.Group("/api")
	{
		api.GET("/status", ginAPIStatus)
		api.GET("/version", ginAPIVersion)

		// Nested group
		v1 := api.Group("/v1")
		{
			v1.GET("/users", ginListUsersV1)
			v1.POST("/users", ginCreateUserV1)
			v1.GET("/users/:id", ginGetUserV1)
		}

		// Another nested group
		v2 := api.Group("/v2")
		{
			v2.GET("/users", ginListUsersV2)
			v2.POST("/users", ginCreateUserV2)
			v2.GET("/users/:id", ginGetUserV2)
		}
	}

	// Admin routes with middleware
	admin := router.Group("/admin")
	admin.Use(ginAdminAuth())
	{
		admin.GET("/dashboard", ginAdminDashboard)
		admin.GET("/users", ginAdminListUsers)
		admin.DELETE("/users/:id", ginAdminDeleteUser)
	}

	return router
}

// SetupGinMiddleware demonstrates middleware usage
func SetupGinMiddleware() *gin.Engine {
	router := gin.New()

	// Global middleware
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	// Custom middleware
	router.Use(ginCorsMiddleware())
	router.Use(ginAuthMiddleware())

	router.GET("/protected", ginProtectedHandler)
	router.POST("/data", ginDataHandler)

	return router
}

// SetupGinAny demonstrates Any method
func SetupGinAny() *gin.Engine {
	router := gin.Default()

	// Handle any HTTP method
	router.Any("/universal", func(c *gin.Context) {
		c.String(http.StatusOK, "Method: "+c.Request.Method)
	})

	// Handle specific methods with Handle
	router.Handle("GET", "/items", ginListItems)
	router.Handle("POST", "/items", ginCreateItem)
	router.Handle("PUT", "/items/:id", ginUpdateItem)
	router.Handle("DELETE", "/items/:id", ginDeleteItem)

	return router
}

// SetupGinNoRoute demonstrates 404 handling
func SetupGinNoRoute() *gin.Engine {
	router := gin.Default()

	router.GET("/exists", func(c *gin.Context) {
		c.String(http.StatusOK, "exists")
	})

	// Custom 404 handler
	router.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
	})

	// Custom 405 handler
	router.NoMethod(func(c *gin.Context) {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"error": "method not allowed"})
	})

	return router
}

// SetupGinStaticFiles demonstrates static file serving
func SetupGinStaticFiles() *gin.Engine {
	router := gin.Default()

	// Static file serving
	router.Static("/static", "./static")
	router.StaticFS("/assets", http.Dir("./assets"))
	router.StaticFile("/favicon.ico", "./static/favicon.ico")

	return router
}

// SetupGinWithBinding demonstrates request binding
func SetupGinWithBinding() *gin.Engine {
	router := gin.Default()

	router.POST("/users", func(c *gin.Context) {
		var user GinUser
		if err := c.ShouldBindJSON(&user); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, user)
	})

	router.POST("/products", func(c *gin.Context) {
		var product GinProduct
		if err := c.BindJSON(&product); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, product)
	})

	return router
}

// Handler implementations
func ginHomeHandler(c *gin.Context) { c.String(http.StatusOK, "Home") }
func ginHealthCheck(c *gin.Context) { c.String(http.StatusOK, "OK") }
func ginListUsers(c *gin.Context)   { c.JSON(http.StatusOK, []GinUser{}) }
func ginCreateUser(c *gin.Context)  { c.Status(http.StatusCreated) }
func ginGetUser(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, GinUser{Name: id})
}
func ginUpdateUser(c *gin.Context) { c.Status(http.StatusOK) }
func ginDeleteUser(c *gin.Context) { c.Status(http.StatusNoContent) }
func ginPatchUser(c *gin.Context)  { c.Status(http.StatusOK) }
func ginServeFile(c *gin.Context) {
	filepath := c.Param("filepath")
	c.String(http.StatusOK, "Serving: "+filepath)
}
func ginGetUserPost(c *gin.Context) {
	userId := c.Param("userId")
	postId := c.Param("postId")
	c.String(http.StatusOK, "User: "+userId+", Post: "+postId)
}
func ginGetUserPostComment(c *gin.Context) {
	c.String(http.StatusOK, "user post comment")
}
func ginGetOrgTeamMember(c *gin.Context) {
	c.String(http.StatusOK, "org team member")
}
func ginListProducts(c *gin.Context)  { c.JSON(http.StatusOK, []GinProduct{}) }
func ginCreateProduct(c *gin.Context) { c.Status(http.StatusCreated) }
func ginGetProduct(c *gin.Context) {
	sku := c.Param("sku")
	c.JSON(http.StatusOK, GinProduct{SKU: sku})
}
func ginAPIStatus(c *gin.Context)        { c.String(http.StatusOK, "OK") }
func ginAPIVersion(c *gin.Context)       { c.String(http.StatusOK, "1.0.0") }
func ginListUsersV1(c *gin.Context)      { c.JSON(http.StatusOK, []GinUser{}) }
func ginCreateUserV1(c *gin.Context)     { c.Status(http.StatusCreated) }
func ginGetUserV1(c *gin.Context)        { c.JSON(http.StatusOK, GinUser{}) }
func ginListUsersV2(c *gin.Context)      { c.JSON(http.StatusOK, []GinUser{}) }
func ginCreateUserV2(c *gin.Context)     { c.Status(http.StatusCreated) }
func ginGetUserV2(c *gin.Context)        { c.JSON(http.StatusOK, GinUser{}) }
func ginAdminAuth() gin.HandlerFunc      { return func(c *gin.Context) { c.Next() } }
func ginAdminDashboard(c *gin.Context)   { c.String(http.StatusOK, "dashboard") }
func ginAdminListUsers(c *gin.Context)   { c.JSON(http.StatusOK, []GinUser{}) }
func ginAdminDeleteUser(c *gin.Context)  { c.Status(http.StatusNoContent) }
func ginCorsMiddleware() gin.HandlerFunc { return func(c *gin.Context) { c.Next() } }
func ginAuthMiddleware() gin.HandlerFunc { return func(c *gin.Context) { c.Next() } }
func ginProtectedHandler(c *gin.Context) { c.String(http.StatusOK, "protected") }
func ginDataHandler(c *gin.Context)      { c.Status(http.StatusCreated) }
func ginListItems(c *gin.Context)        { c.JSON(http.StatusOK, []string{}) }
func ginCreateItem(c *gin.Context)       { c.Status(http.StatusCreated) }
func ginUpdateItem(c *gin.Context)       { c.Status(http.StatusOK) }
func ginDeleteItem(c *gin.Context)       { c.Status(http.StatusNoContent) }
