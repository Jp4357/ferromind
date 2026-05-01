variable "aws_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name — used as prefix for all resource names"
  type        = string
  default     = "ferromind"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "ecs_cpu" {
  description = "ECS task CPU units (256 | 512 | 1024 | 2048 | 4096)"
  type        = number
  default     = 512
}

variable "ecs_memory" {
  description = "ECS task memory in MB (must be compatible with cpu)"
  type        = number
  default     = 1024
}

variable "ecs_desired_count" {
  description = "Number of backend containers to run"
  type        = number
  default     = 1
}

variable "backend_image_tag" {
  description = "ECR image tag to deploy — CI/CD sets this per build"
  type        = string
  default     = "latest"
}
