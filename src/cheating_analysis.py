import numpy as np
import pandas as pd
from itertools import combinations
import logging
import math

logger = logging.getLogger(__name__)


class CheatingDetector:
    def __init__(self, results_df, answer_key, questions_in_order):
        """
        Initialize the CheatingDetector.
        
        Args:
            results_df (pd.DataFrame): DataFrame containing student responses. 
                                     Must contain a unique identifier column (e.g., 'File Name' or 'Student ID').
            answer_key (dict): Dictionary mapping question IDs to correct answers.
            questions_in_order (list): List of question IDs in the order they appear in the DataFrame.
        """
        self.df = results_df
        self.answer_key = answer_key
        self.questions = questions_in_order
        self.student_ids = self.df.index.tolist() # Assuming index is set to student identifier before passing, or we handle it here
        
        # Precompute correct/incorrect matrices
        self._prepare_data()

    def _prepare_data(self):
        """Prepare data structures for analysis."""
        # Extract response matrix (Students x Questions)
        self.response_matrix = self.df[self.questions].to_numpy()
        
        # Create answer key vector
        # Handle cases where answer key might be complex (e.g., lists), strictly matching string representation for now
        self.key_vector = np.array([str(self.answer_key.get(q, "")) for q in self.questions])
        
        # Identify valid questions (where answer key is not empty)
        self.empty_values = {'', '-', '*', ' '}
        self.valid_key_mask = np.array([str(k).strip() not in self.empty_values for k in self.key_vector])
        
        # Boolean matrix: True where student answer == answer key
        self.correct_matrix = (self.response_matrix == self.key_vector)
        
        # For student scores, only count questions with valid answer keys
        # Also exclude empty student answers (they shouldn't match empty keys as "correct")
        valid_correct = self.correct_matrix & self.valid_key_mask
        
        # Calculate individual student statistics - only count valid questions
        self.student_scores = valid_correct.sum(axis=1)
        self.num_questions = len(self.questions)
        
        # Calculate question statistics (difficulty/p-values)
        # Fraction of students who got it right
        self.p_values = self.correct_matrix.mean(axis=0)
        
        # For IRT (simplified), estimation of abilities (theta) could go here
        
        self.option_probs = self._compute_option_probabilities()

    def _compute_option_probabilities(self):
        """
        Compute empirical probability of each option for each question.
        Returns:
            list of dicts: [{option: prob}, ...] per question
        """
        probs = []
        n_students = len(self.df)
        for col_idx in range(self.num_questions):
            col_data = self.response_matrix[:, col_idx]
            # Unique options and their counts
            unique, counts = np.unique(col_data, return_counts=True)
            prob_map = {val: count/n_students for val, count in zip(unique, counts)}
            probs.append(prob_map)
        return probs

    def _binom_sf(self, k, n, p):
        """
        Binomial survival function (P(X >= k)).
        Returns prob of getting k or more successes in n trials with prob p.
        """
        if k > n:
            return 0.0
        
        # for small n, exact sum
        prob_sum = 0.0
        # P(X >= k) = sum_{i=k}^n (n choose i) * p^i * (1-p)^(n-i)
        for i in range(k, n + 1):
            comb = math.comb(n, i)
            # Use log exp for stability if needed, but standard pow is fine for n<200
            term = comb * (p**i) * ((1-p)**(n-i))
            prob_sum += term
        return prob_sum

    def _z_score_to_prob(self, z):
        """
        Approximate P(Z >= z) for standard normal.
        """
        # Using approximation for error function
        return 0.5 * math.erfc(z / math.sqrt(2))
        
    def analyze(self):
        """
        Perform all cheating detection analyses on all pairs of students.
        
        Returns:
            list: List of dictionaries, each containing stats for a pair of students.
        """
        results = []
        pairs = list(combinations(range(len(self.df)), 2))
        
        for idx_a, idx_b in pairs:
            # Basic info
            student_a = self.df.iloc[idx_a]
            student_b = self.df.iloc[idx_b]
            id_a = student_a.name # Assuming index is set
            id_b = student_b.name
            
            # Responses
            resp_a = self.response_matrix[idx_a]
            resp_b = self.response_matrix[idx_b]
            
            # Common Logic
            # Identical responses (excluding empty answers)
            # Empty values shouldn't count as agreements
            empty_values = {'', '-', '*', ' '}
            not_empty_a = np.array([str(v).strip() not in empty_values for v in resp_a])
            not_empty_b = np.array([str(v).strip() not in empty_values for v in resp_b])
            both_answered = not_empty_a & not_empty_b
            
            agreements = (resp_a == resp_b) & both_answered
            num_agreements = np.sum(agreements)
            
            # Identical WRONG responses
            # Both wrong AND equal (which implies equal to each other)
            # Mask of items where A is wrong
            wrong_mask_a = (resp_a != self.key_vector)
            # Mask of items where B is wrong 
            wrong_mask_b = (resp_b != self.key_vector)
            
            # Shared wrongs
            w_agreements = agreements & wrong_mask_a # Since if equal, both are wrong
            num_w_agreements = np.sum(w_agreements)
            
            # Number of wrongs for each
            num_wrong_a = np.sum(wrong_mask_a)
            num_wrong_b = np.sum(wrong_mask_b)
            
            pair_stats = {
                "student_a": str(id_a),
                "student_b": str(id_b),
                "agreements": int(num_agreements),
                "w_agreements": int(num_w_agreements),
                "score_a": int(self.student_scores[idx_a]),
                "score_b": int(self.student_scores[idx_b]),
                "wrongs_a": int(num_wrong_a),
                "wrongs_b": int(num_wrong_b)
            }
            
            # --- Advanced Indices ---
            
            # K-Index (Directional)
            # K_AB: A copies B (Reference: B's wrongs)
            k_ab_p = self._compute_k_index(resp_a, resp_b, wrong_mask_b)
            # K_BA: B copies A (Reference: A's wrongs)
            k_ba_p = self._compute_k_index(resp_b, resp_a, wrong_mask_a)
            
            pair_stats["k_index_ab"] = k_ab_p
            pair_stats["k_index_ba"] = k_ba_p
            
            # S2 / GBT (Symmetric or Directional - here Symmetric Match Probability)
            # We calculate the probability of the OBSERVED match pattern occurring by chance
            pair_stats["gbt_z"] = self._compute_gbt_z(resp_a, resp_b)
            
            # Wesolowsky (Robust)
            # Simple implementation: weighted matches
            pair_stats["wesolowsky"] = self._compute_wesolowsky(resp_a, resp_b)

            results.append(pair_stats)
            
        return results

    def _compute_k_index(self, copier_resp, source_resp, source_wrong_mask):
        """
        Calculate K-index probability (p-value) that Copier matched Source's wrong answers by chance.
        Lower p-value = Higher suspicion.
        """
        # Indices where Source was wrong
        wrong_indices = np.where(source_wrong_mask)[0]
        n = len(wrong_indices)
        
        if n == 0:
            return 1.0 # Cannot copy wrongs if source has no wrongs
        
        # Matches on these specific items
        # match_count = sum(copier_resp[i] == source_resp[i] for i in wrong_indices)
        matches = (copier_resp[wrong_indices] == source_resp[wrong_indices])
        k_obs = np.sum(matches)
        
        if k_obs == 0:
            return 1.0
            
        # Calculate functional average probability of matching
        # For each item in wrong_indices, what is prob of Random Student picking Source's answer?
        probs = []
        for i in wrong_indices:
            source_ans = source_resp[i]
            # Empirical prob of choosing 'source_ans' for question 'i'
            p = self.option_probs[i].get(source_ans, 0.0)
            probs.append(p)
            
        avg_p = sum(probs) / n if n > 0 else 0
        
        # Binomial survival function
        return self._binom_sf(k_obs, n, avg_p)

    def _compute_gbt_z(self, resp_a, resp_b):
        """
        Generalized Binomial Test Z-score.
        Measures if total agreement is higher than expected.
        """
        expected_matches = 0.0
        var_matches = 0.0
        
        observed_matches = np.sum(resp_a == resp_b)
        
        for i in range(self.num_questions):
            # Prob of match by chance on question i
            # Sum (P(A=v) * P(B=v)) for all v?
            # Assuming independence and identical distribution (simplification matches empirical)
            # P(Match_i) = sum( prob(v)^2 ) for v in options
            
            opts = self.option_probs[i]
            p_match_i = sum(p**2 for p in opts.values())
            
            expected_matches += p_match_i
            var_matches += p_match_i * (1 - p_match_i)
            
        if var_matches == 0:
            return 0.0
            
        z = (observed_matches - expected_matches) / math.sqrt(var_matches)
        return z

    def _compute_wesolowsky(self, resp_a, resp_b):
        """
        A simplified robust similarity measure.
        """
        # Here we just use the Z-score from GBT as it's the most robust general measure
        # Wesolowsky's specific method involves removing 'easy' matches, but GBT with p^2 weights handles that naturally
        # (Easy items have high p -> high expected match -> lower Z contribution).
        return self._compute_gbt_z(resp_a, resp_b)


