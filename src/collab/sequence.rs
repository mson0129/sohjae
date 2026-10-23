use std::collections::{BTreeMap, BTreeSet};
#[derive(Clone)]
pub(super) struct Sequence<K: Ord, V> {
    nodes: BTreeMap<K, V>,
    children: BTreeMap<Option<K>, BTreeSet<K>>,
}
impl<K: Ord, V> Default for Sequence<K, V> {
    fn default() -> Self {
        Self {
            nodes: BTreeMap::new(),
            children: BTreeMap::new(),
        }
    }
}
impl<K: Ord + Copy, V> Sequence<K, V> {
    pub fn contains(&self, id: K) -> bool {
        self.nodes.contains_key(&id)
    }
    pub fn value(&self, id: K) -> Option<&V> {
        self.nodes.get(&id)
    }
    pub fn insert(&mut self, id: K, after: Option<K>, value: V) {
        self.nodes.insert(id, value);
        self.children.entry(after).or_default().insert(id);
    }
    pub fn placements(&self) -> BTreeMap<K, Option<K>> {
        self.children
            .iter()
            .flat_map(|(parent, children)| children.iter().map(move |id| (*id, *parent)))
            .collect()
    }
    pub fn ordered(&self) -> Vec<K> {
        let mut stack: Vec<K> = self
            .children
            .get(&None)
            .map_or_else(Vec::new, |ids| ids.iter().copied().collect());
        let mut output = Vec::with_capacity(self.nodes.len());
        // Descending sibling IDs keep a later insertion before the original continuation.
        while let Some(id) = stack.pop() {
            output.push(id);
            if let Some(children) = self.children.get(&Some(id)) {
                stack.extend(children);
            }
        }
        output
    }
}
