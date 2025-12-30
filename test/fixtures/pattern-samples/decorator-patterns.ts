/**
 * Test Fixtures: Decorator Patterns
 * 
 * Various TypeScript decorator patterns used to test PatternMatcher.
 * These examples represent NestJS-style and similar decorator-based frameworks.
 * 
 * Pattern Type: 'decorator' - Decorators like @Get(), @Post(), @Body()
 */

// ============================================================================
// Mock Decorators (for type checking)
// ============================================================================

// Route decorators
function Controller(path?: string): ClassDecorator {
  return (target) => target;
}

function Get(path?: string): MethodDecorator {
  return (target, key, descriptor) => descriptor;
}

function Post(path?: string): MethodDecorator {
  return (target, key, descriptor) => descriptor;
}

function Put(path?: string): MethodDecorator {
  return (target, key, descriptor) => descriptor;
}

function Delete(path?: string): MethodDecorator {
  return (target, key, descriptor) => descriptor;
}

function Patch(path?: string): MethodDecorator {
  return (target, key, descriptor) => descriptor;
}

// Parameter decorators
function Body(key?: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {};
}

function Query(key?: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {};
}

function Param(key?: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {};
}

function Headers(key?: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {};
}

// Schema/Validation decorators
function ApiProperty(options?: any): PropertyDecorator {
  return (target, propertyKey) => {};
}

function IsString(): PropertyDecorator {
  return (target, propertyKey) => {};
}

function IsNumber(): PropertyDecorator {
  return (target, propertyKey) => {};
}

function IsOptional(): PropertyDecorator {
  return (target, propertyKey) => {};
}

function IsEmail(): PropertyDecorator {
  return (target, propertyKey) => {};
}

function MinLength(min: number): PropertyDecorator {
  return (target, propertyKey) => {};
}

function MaxLength(max: number): PropertyDecorator {
  return (target, propertyKey) => {};
}

// Response/API decorators
function ApiResponse(options: { status: number; type?: any; description?: string }): MethodDecorator {
  return (target, key, descriptor) => descriptor;
}

function ApiBody(options: { type: any; required?: boolean }): MethodDecorator {
  return (target, key, descriptor) => descriptor;
}

function ApiOperation(options: { summary: string; description?: string }): MethodDecorator {
  return (target, key, descriptor) => descriptor;
}

// Injectable decorator
function Injectable(): ClassDecorator {
  return (target) => target;
}

// ============================================================================
// DTO Classes with Validation Decorators
// ============================================================================

/**
 * CreateUserDto - DTO with validation decorators
 * Expected: Extract schema from decorated properties
 */
class CreateUserDto {
  @ApiProperty({ description: 'User name' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'User email', format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'User age', required: false })
  @IsNumber()
  @IsOptional()
  age?: number;

  @ApiProperty({ description: 'User password' })
  @IsString()
  @MinLength(8)
  password!: string;
}

/**
 * UpdateUserDto - Partial DTO for updates
 */
class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsNumber()
  @IsOptional()
  age?: number;
}

/**
 * UserResponseDto - Response DTO
 */
class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id!: string;

  @ApiProperty({ description: 'User name' })
  name!: string;

  @ApiProperty({ description: 'User email' })
  email!: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;
}

// ============================================================================
// NestJS Controller Example
// ============================================================================

/**
 * UsersController - Full NestJS-style controller
 * Expected: Match @Controller, @Get, @Post, @Put, @Delete decorators
 */
@Controller('users')
class UsersController {
  /**
   * Get all users
   */
  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  findAll(@Query('limit') limit?: number): UserResponseDto[] {
    return [];
  }

  /**
   * Get user by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string): UserResponseDto {
    return { id, name: '', email: '', createdAt: new Date() };
  }

  /**
   * Create new user
   */
  @Post()
  @ApiOperation({ summary: 'Create new user' })
  @ApiBody({ type: CreateUserDto, required: true })
  @ApiResponse({ status: 201, type: UserResponseDto })
  create(@Body() createUserDto: CreateUserDto): UserResponseDto {
    return { id: '1', name: createUserDto.name, email: createUserDto.email, createdAt: new Date() };
  }

  /**
   * Update user
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, type: UserResponseDto })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ): UserResponseDto {
    return { id, name: '', email: '', createdAt: new Date() };
  }

  /**
   * Partially update user
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Partially update user' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, type: UserResponseDto })
  partialUpdate(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ): UserResponseDto {
    return { id, name: '', email: '', createdAt: new Date() };
  }

  /**
   * Delete user
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 204, description: 'User deleted' })
  remove(@Param('id') id: string): void {
    // Delete logic
  }
}

// ============================================================================
// Posts Controller with Nested Routes
// ============================================================================

@Controller('posts')
class PostsController {
  @Get()
  @ApiResponse({ status: 200 })
  findAll(): any[] {
    return [];
  }

  @Post()
  @ApiBody({ type: Object })
  create(@Body() body: any): any {
    return body;
  }

  @Get(':postId/comments')
  findComments(@Param('postId') postId: string): any[] {
    return [];
  }

  @Post(':postId/comments')
  createComment(
    @Param('postId') postId: string,
    @Body() body: any
  ): any {
    return body;
  }
}

// ============================================================================
// Service with Injectable Decorator
// ============================================================================

@Injectable()
class UsersService {
  findAll(): UserResponseDto[] {
    return [];
  }

  findOne(id: string): UserResponseDto | null {
    return null;
  }

  create(dto: CreateUserDto): UserResponseDto {
    return { id: '1', name: dto.name, email: dto.email, createdAt: new Date() };
  }
}

// ============================================================================
// Edge Cases
// ============================================================================

// Multiple decorators on same element
class MultiDecoratorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @ApiProperty({ description: 'Multi-decorated field' })
  multiField!: string;
}

// Decorator without parentheses (property decorator shorthand)
// Note: This is valid TypeScript but less common
function SimpleDecorator(target: any, propertyKey: string) {}

class SimpleDecoratorExample {
  @SimpleDecorator
  simpleField!: string;
}

// Class decorator with options
function Module(options: { imports?: any[]; controllers?: any[]; providers?: any[] }): ClassDecorator {
  return (target) => target;
}

@Module({
  imports: [],
  controllers: [UsersController, PostsController],
  providers: [UsersService],
})
class AppModule {}

export {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UsersController,
  PostsController,
  UsersService,
  MultiDecoratorDto,
  SimpleDecoratorExample,
  AppModule,
};
