terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # ── Remote state (enable after first apply) ────────────────────────────────
  # 1. Create the bucket manually:  aws s3 mb s3://ferromind-tfstate-<account-id>
  # 2. Create the lock table:       aws dynamodb create-table --table-name ferromind-tfstate-locks \
  #                                   --attribute-definitions AttributeName=LockID,AttributeType=S \
  #                                   --key-schema AttributeName=LockID,KeyType=HASH \
  #                                   --billing-mode PAY_PER_REQUEST
  # 3. Uncomment the block below and run: terraform init -migrate-state
  #
  # backend "s3" {
  #   bucket         = "ferromind-tfstate-<account-id>"
  #   key            = "production/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "ferromind-tfstate-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "FerroMind"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# us-east-1 is already the main region — no alias needed for CloudFront ACM certs

data "aws_caller_identity" "current" {}
