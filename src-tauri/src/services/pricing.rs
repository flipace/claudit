//! Centralized pricing for Claude models
//!
//! All token costs are per 1 million tokens (MTok).
//! Cache write prices are for 5-minute TTL cache.
//! Cache read prices are for cache hits and refreshes.

use crate::types::TokenCosts;
use serde::{Deserialize, Serialize};

/// Model pricing info for display in UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPricing {
    pub model_name: String,
    pub input: f64,
    pub output: f64,
    pub cache_read: f64,
    pub cache_write: f64,
}

/// Get all model pricing for display
pub fn get_all_pricing() -> Vec<ModelPricing> {
    vec![
        ModelPricing {
            model_name: "Claude Opus 4.5".to_string(),
            input: 5.0,
            output: 25.0,
            cache_read: 0.50,
            cache_write: 6.25,
        },
        ModelPricing {
            model_name: "Claude Opus 4 / 4.1 / 3".to_string(),
            input: 15.0,
            output: 75.0,
            cache_read: 1.50,
            cache_write: 18.75,
        },
        ModelPricing {
            model_name: "Claude Sonnet 4 / 4.5 / 3.7".to_string(),
            input: 3.0,
            output: 15.0,
            cache_read: 0.30,
            cache_write: 3.75,
        },
        ModelPricing {
            model_name: "Claude Haiku 4.5".to_string(),
            input: 1.0,
            output: 5.0,
            cache_read: 0.10,
            cache_write: 1.25,
        },
        ModelPricing {
            model_name: "Claude Haiku 3.5".to_string(),
            input: 0.80,
            output: 4.0,
            cache_read: 0.08,
            cache_write: 1.0,
        },
        ModelPricing {
            model_name: "Claude Haiku 3".to_string(),
            input: 0.25,
            output: 1.25,
            cache_read: 0.03,
            cache_write: 0.30,
        },
    ]
}

/// Get token costs for a specific model
///
/// Pricing source: https://docs.anthropic.com/en/docs/about-claude/models
pub fn get_model_costs(model: &str) -> TokenCosts {
    let model_lower = model.to_lowercase();

    // Opus 4.5 (newest, most capable)
    if model_lower.contains("opus-4-5") || model_lower.contains("opus-4.5") {
        return TokenCosts {
            input: 5.0,
            output: 25.0,
            cache_read: 0.50,
            cache_write: 6.25,
        };
    }

    // Opus 4.1 / Opus 4 / Opus 3 (all use same pricing)
    if model_lower.contains("opus") {
        return TokenCosts {
            input: 15.0,
            output: 75.0,
            cache_read: 1.50,
            cache_write: 18.75,
        };
    }

    // Haiku 4.5
    if model_lower.contains("haiku-4-5") || model_lower.contains("haiku-4.5") {
        return TokenCosts {
            input: 1.0,
            output: 5.0,
            cache_read: 0.10,
            cache_write: 1.25,
        };
    }

    // Haiku 3.5
    if model_lower.contains("haiku-3-5") || model_lower.contains("haiku-3.5") {
        return TokenCosts {
            input: 0.80,
            output: 4.0,
            cache_read: 0.08,
            cache_write: 1.0,
        };
    }

    // Haiku 3 (original)
    if model_lower.contains("haiku") {
        return TokenCosts {
            input: 0.25,
            output: 1.25,
            cache_read: 0.03,
            cache_write: 0.30,
        };
    }

    // Default to Sonnet pricing (Sonnet 4.5, 4, 3.7, 3.5)
    TokenCosts {
        input: 3.0,
        output: 15.0,
        cache_read: 0.30,
        cache_write: 3.75,
    }
}

/// Calculate the total cost for a usage entry
pub fn calculate_cost(
    model: &str,
    input_tokens: u64,
    output_tokens: u64,
    cache_creation_tokens: u64,
    cache_read_tokens: u64,
) -> f64 {
    let costs = get_model_costs(model);
    let per_million = 1_000_000.0;

    let input_cost = (input_tokens as f64 / per_million) * costs.input;
    let output_cost = (output_tokens as f64 / per_million) * costs.output;
    let cache_read_cost = (cache_read_tokens as f64 / per_million) * costs.cache_read;
    let cache_write_cost = (cache_creation_tokens as f64 / per_million) * costs.cache_write;

    input_cost + output_cost + cache_read_cost + cache_write_cost
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sonnet_pricing() {
        let costs = get_model_costs("claude-sonnet-4-20250514");
        assert_eq!(costs.input, 3.0);
        assert_eq!(costs.output, 15.0);
    }

    #[test]
    fn test_opus_4_pricing() {
        let costs = get_model_costs("claude-opus-4-20250514");
        assert_eq!(costs.input, 15.0);
        assert_eq!(costs.output, 75.0);
    }

    #[test]
    fn test_opus_4_5_pricing() {
        let costs = get_model_costs("claude-opus-4-5-20250514");
        assert_eq!(costs.input, 5.0);
        assert_eq!(costs.output, 25.0);
    }

    #[test]
    fn test_haiku_pricing() {
        let costs = get_model_costs("claude-haiku-3-20240307");
        assert_eq!(costs.input, 0.25);
        assert_eq!(costs.output, 1.25);
    }

    #[test]
    fn test_cost_calculation() {
        // 1M input tokens + 1M output tokens with sonnet = $3 + $15 = $18
        let cost = calculate_cost("claude-sonnet-4-20250514", 1_000_000, 1_000_000, 0, 0);
        assert_eq!(cost, 18.0);
    }
}
