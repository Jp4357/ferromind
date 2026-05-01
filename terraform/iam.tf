# ── ECS task execution role ───────────────────────────────────────────────────
# Used by ECS to pull images from ECR, get secrets, and write logs

resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow the execution role to read the OpenAI key from Secrets Manager
resource "aws_iam_role_policy" "ecs_secrets_access" {
  name = "${var.project_name}-ecs-secrets-access"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.openai_key.arn
    }]
  })
}

# ── Secrets Manager — OpenAI API key ─────────────────────────────────────────

resource "aws_secretsmanager_secret" "openai_key" {
  name        = "${var.project_name}/openai-api-key"
  description = "OpenAI API key for FerroMind ML Advisor"
  tags        = { Name = "${var.project_name}-openai-key" }
}

# Populate the secret after apply (Terraform never stores the actual key):
#
#   aws secretsmanager put-secret-value \
#     --secret-id ferromind/openai-api-key \
#     --secret-string '{"OPENAI_API_KEY":"sk-proj-..."}'
#
# The ECS task reads OPENAI_API_KEY from this secret at container startup.
