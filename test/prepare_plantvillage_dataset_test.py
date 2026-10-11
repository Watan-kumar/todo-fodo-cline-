import unittest

from tools.prepare_plantvillage_dataset import validation_leaf_ids


class ValidationLeafIdsTest(unittest.TestCase):
    def test_is_deterministic_and_selects_only_existing_leaf_ids(self):
        leaves = ["leaf-a", "leaf-a", "leaf-b", "leaf-c", "leaf-d"]

        first = validation_leaf_ids(leaves, 0.25, 42)
        second = validation_leaf_ids(leaves, 0.25, 42)

        self.assertEqual(first, second)
        self.assertEqual(len(first), 1)
        self.assertTrue(first.issubset(set(leaves)))

    def test_rejects_fraction_that_would_empty_a_split(self):
        with self.assertRaises(ValueError):
            validation_leaf_ids(["leaf-a", "leaf-b"], 1, 42)


if __name__ == "__main__":
    unittest.main()
