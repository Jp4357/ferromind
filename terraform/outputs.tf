output "cloudfront_url" {
  description = "Public URL — set as NEXT_PUBLIC_API_URL when building the frontend"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID — used by CI/CD to invalidate cache after deploy"
  value       = aws_cloudfront_distribution.main.id
}

output "ecr_repository_url" {
  description = "ECR URL — docker push target"
  value       = aws_ecr_repository.backend.repository_url
}

output "s3_bucket_name" {
  description = "Frontend S3 bucket — aws s3 sync target"
  value       = aws_s3_bucket.frontend.bucket
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name — used in force-new-deployment command"
  value       = aws_ecs_service.backend.name
}

output "alb_dns" {
  description = "ALB DNS name (internal — traffic comes through CloudFront)"
  value       = aws_lb.main.dns_name
}

output "openai_secret_arn" {
  description = "Secrets Manager ARN — populate with: aws secretsmanager put-secret-value --secret-id <arn> --secret-string '{\"OPENAI_API_KEY\":\"sk-...\"}'"
  value       = aws_secretsmanager_secret.openai_key.arn
}
