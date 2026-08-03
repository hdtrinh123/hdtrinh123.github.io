// Pattern registry — signatures lifted from HexActions.java @ v0.11.3.
// The angle signature alone is the lookup key; start_dir is canonical render data.

const PATTERNS = [
  // --- basics / getters -----------------------------------------------------
  { n: "Mind's Reflection", id: 'get_caster', s: 'qaq', d: 'NORTH_EAST', in: '', out: 'entity', c: 'basics' },
  { n: "Compass' Purification", id: 'entity_pos/eye', s: 'aa', d: 'EAST', in: 'entity', out: 'vector', c: 'basics' },
  { n: "Compass' Purification II", id: 'entity_pos/foot', s: 'dd', d: 'NORTH_EAST', in: 'entity', out: 'vector', c: 'basics' },
  { n: "Alidade's Purification", id: 'get_entity_look', s: 'wa', d: 'EAST', in: 'entity', out: 'vector', c: 'basics' },
  { n: "Stadiometer's Purification", id: 'get_entity_height', s: 'awq', d: 'NORTH_EAST', in: 'entity', out: 'number', c: 'basics' },
  { n: 'Pace Purification', id: 'get_entity_velocity', s: 'wq', d: 'EAST', in: 'entity', out: 'vector', c: 'basics' },
  { n: "Archer's Distillation", id: 'raycast', s: 'wqaawdd', d: 'EAST', in: 'vector, vector', out: 'vector', c: 'basics' },
  { n: "Architect's Distillation", id: 'raycast/axis', s: 'weddwaa', d: 'EAST', in: 'vector, vector', out: 'vector', c: 'basics' },
  { n: "Scout's Distillation", id: 'raycast/entity', s: 'weaqa', d: 'EAST', in: 'vector, vector', out: 'entity', c: 'basics' },

  // --- stack manipulation ---------------------------------------------------
  { n: "Jester's Gambit", id: 'swap', s: 'aawdd', d: 'EAST', in: 'any, any', out: 'any, any', c: 'stack' },
  { n: 'Rotation Gambit', id: 'rotate', s: 'aaeaa', d: 'EAST', in: 'any x3', out: 'any x3', c: 'stack' },
  { n: 'Rotation Gambit II', id: 'rotate_reverse', s: 'ddqdd', d: 'NORTH_EAST', in: 'any x3', out: 'any x3', c: 'stack' },
  { n: 'Gemini Decomposition', id: 'duplicate', s: 'aadaa', d: 'EAST', in: 'any', out: 'any, any', c: 'stack' },
  { n: "Prospector's Gambit", id: 'over', s: 'aaedd', d: 'EAST', in: 'any, any', out: 'any x3', c: 'stack' },
  { n: "Undertaker's Gambit", id: 'tuck', s: 'ddqaa', d: 'EAST', in: 'any, any', out: 'any x3', c: 'stack' },
  { n: 'Dioscuri Gambit', id: '2dup', s: 'aadadaaw', d: 'EAST', in: 'any, any', out: 'any x4', c: 'stack' },
  { n: "Flock's Reflection", id: 'stack_len', s: 'qwaeawqaeaqa', d: 'NORTH_WEST', in: '', out: 'number', c: 'stack' },
  { n: 'Gemini Gambit', id: 'duplicate_n', s: 'aadaadaa', d: 'EAST', in: 'any, number', out: 'many', c: 'stack' },
  { n: "Fisherman's Gambit", id: 'fisherman', s: 'ddad', d: 'WEST', in: 'number', out: 'any', c: 'stack' },
  { n: "Fisherman's Gambit II", id: 'fisherman/copy', s: 'aada', d: 'EAST', in: 'number', out: 'any', c: 'stack' },
  { n: "Swindler's Gambit", id: 'swizzle', s: 'qaawdde', d: 'SOUTH_EAST', in: 'many, number', out: 'many', c: 'stack' },

  // --- math -----------------------------------------------------------------
  { n: 'Additive Distillation', id: 'add', s: 'waaw', d: 'NORTH_EAST', in: 'num|vec, num|vec', out: 'num|vec', c: 'math' },
  { n: 'Subtractive Distillation', id: 'sub', s: 'wddw', d: 'NORTH_WEST', in: 'num|vec, num|vec', out: 'num|vec', c: 'math' },
  { n: 'Multiplicative Distillation', id: 'mul', s: 'waqaw', d: 'SOUTH_EAST', in: 'num|vec, num|vec', out: 'num|vec', c: 'math' },
  { n: 'Division Distillation', id: 'div', s: 'wdedw', d: 'NORTH_EAST', in: 'num|vec, num|vec', out: 'num|vec', c: 'math' },
  { n: 'Length Purification', id: 'abs', s: 'wqaqw', d: 'NORTH_EAST', in: 'num|vec|list', out: 'number', c: 'math' },
  { n: 'Power Distillation', id: 'pow', s: 'wedew', d: 'NORTH_WEST', in: 'num|vec, num|vec', out: 'num|vec', c: 'math' },
  { n: 'Floor Purification', id: 'floor', s: 'ewq', d: 'EAST', in: 'num|vec', out: 'num|vec', c: 'math' },
  { n: 'Ceiling Purification', id: 'ceil', s: 'qwe', d: 'EAST', in: 'num|vec', out: 'num|vec', c: 'math' },
  { n: 'Vector Exaltation', id: 'construct_vec', s: 'eqqqqq', d: 'EAST', in: 'num x3', out: 'vector', c: 'math' },
  { n: 'Vector Disintegration', id: 'deconstruct_vec', s: 'qeeeee', d: 'EAST', in: 'vector', out: 'num x3', c: 'math' },
  { n: 'Axial Purification', id: 'coerce_axial', s: 'qqqqqaww', d: 'NORTH_WEST', in: 'vec|num', out: 'vec|num', c: 'math' },
  { n: 'Modulus Distillation', id: 'modulo', s: 'addwaad', d: 'NORTH_EAST', in: 'num|vec, num|vec', out: 'num|vec', c: 'math' },
  { n: 'Logarithmic Distillation', id: 'logarithm', s: 'eqaqe', d: 'NORTH_WEST', in: 'num, num', out: 'number', c: 'math' },
  { n: 'Entropy Reflection', id: 'random', s: 'eqqq', d: 'NORTH_WEST', in: '', out: 'number', c: 'math' },
  { n: 'Sine Purification', id: 'sin', s: 'qqqqqaa', d: 'SOUTH_EAST', in: 'number', out: 'number', c: 'math' },
  { n: 'Cosine Purification', id: 'cos', s: 'qqqqqad', d: 'SOUTH_EAST', in: 'number', out: 'number', c: 'math' },
  { n: 'Tangent Purification', id: 'tan', s: 'wqqqqqadq', d: 'SOUTH_WEST', in: 'number', out: 'number', c: 'math' },
  { n: 'Inverse Sine Purification', id: 'arcsin', s: 'ddeeeee', d: 'SOUTH_EAST', in: 'number', out: 'number', c: 'math' },
  { n: 'Inverse Cosine Purification', id: 'arccos', s: 'adeeeee', d: 'NORTH_EAST', in: 'number', out: 'number', c: 'math' },
  { n: 'Inverse Tangent Purification', id: 'arctan', s: 'eadeeeeew', d: 'NORTH_EAST', in: 'number', out: 'number', c: 'math' },
  { n: 'Inverse Tangent Distillation', id: 'arctan2', s: 'deadeeeeewd', d: 'WEST', in: 'num, num', out: 'number', c: 'math' },

  // --- logic ----------------------------------------------------------------
  { n: 'Conjunction Distillation', id: 'and', s: 'wdw', d: 'NORTH_EAST', in: 'bool|num|list x2', out: 'bool|num|list', c: 'logic' },
  { n: 'Disjunction Distillation', id: 'or', s: 'waw', d: 'SOUTH_EAST', in: 'bool|num|list x2', out: 'bool|num|list', c: 'logic' },
  { n: 'Exclusion Distillation', id: 'xor', s: 'dwa', d: 'NORTH_WEST', in: 'bool|num|list x2', out: 'bool|num|list', c: 'logic' },
  { n: 'Negation Purification', id: 'not', s: 'dw', d: 'NORTH_WEST', in: 'bool|num', out: 'bool|num', c: 'logic' },
  { n: 'Maximus Distillation', id: 'greater', s: 'e', d: 'SOUTH_EAST', in: 'num, num', out: 'bool', c: 'logic' },
  { n: 'Minimus Distillation', id: 'less', s: 'q', d: 'SOUTH_WEST', in: 'num, num', out: 'bool', c: 'logic' },
  { n: 'Maximus Distillation II', id: 'greater_eq', s: 'ee', d: 'SOUTH_EAST', in: 'num, num', out: 'bool', c: 'logic' },
  { n: 'Minimus Distillation II', id: 'less_eq', s: 'qq', d: 'SOUTH_WEST', in: 'num, num', out: 'bool', c: 'logic' },
  { n: 'Equality Distillation', id: 'equals', s: 'ad', d: 'EAST', in: 'any, any', out: 'bool', c: 'logic' },
  { n: 'Inequality Distillation', id: 'not_equals', s: 'da', d: 'EAST', in: 'any, any', out: 'bool', c: 'logic' },
  { n: "Augur's Purification", id: 'bool_coerce', s: 'aw', d: 'NORTH_EAST', in: 'any', out: 'bool', c: 'logic' },
  { n: "Augur's Exaltation", id: 'if', s: 'awdd', d: 'SOUTH_EAST', in: 'bool, any, any', out: 'any', c: 'logic' },
  { n: 'Uniqueness Purification', id: 'unique', s: 'aweaqa', d: 'NORTH_EAST', in: 'list', out: 'list', c: 'logic' },

  // --- lists ----------------------------------------------------------------
  { n: 'Integration Distillation', id: 'append', s: 'edqde', d: 'SOUTH_WEST', in: 'list, any', out: 'list', c: 'lists' },
  { n: 'Derivation Decomposition', id: 'unappend', s: 'qaeaq', d: 'NORTH_WEST', in: 'list', out: 'list, any', c: 'lists' },
  { n: 'Selection Distillation', id: 'index', s: 'deeed', d: 'NORTH_WEST', in: 'list, num', out: 'any', c: 'lists' },
  { n: "Single's Purification", id: 'singleton', s: 'adeeed', d: 'EAST', in: 'any', out: 'list', c: 'lists' },
  { n: 'Vacant Reflection', id: 'empty_list', s: 'qqaeaae', d: 'NORTH_EAST', in: '', out: 'list', c: 'lists' },
  { n: 'Retrograde Purification', id: 'reverse', s: 'qqqaede', d: 'EAST', in: 'list', out: 'list', c: 'lists' },
  { n: "Flock's Gambit", id: 'last_n_list', s: 'ewdqdwe', d: 'SOUTH_WEST', in: 'many, num', out: 'list', c: 'lists' },
  { n: "Flock's Disintegration", id: 'splat', s: 'qwaeawq', d: 'NORTH_WEST', in: 'list', out: 'many', c: 'lists' },
  { n: "Locator's Distillation", id: 'index_of', s: 'dedqde', d: 'EAST', in: 'list, any', out: 'number', c: 'lists' },
  { n: "Excisor's Distillation", id: 'remove_from', s: 'edqdewaqa', d: 'SOUTH_WEST', in: 'list, num', out: 'list', c: 'lists' },
  { n: 'Selection Exaltation', id: 'slice', s: 'qaeaqwded', d: 'NORTH_WEST', in: 'list, num, num', out: 'list', c: 'lists' },
  { n: "Surgeon's Exaltation", id: 'replace', s: 'wqaeaqw', d: 'NORTH_WEST', in: 'list, num, any', out: 'list', c: 'lists' },
  { n: "Speaker's Distillation", id: 'construct', s: 'ddewedd', d: 'SOUTH_EAST', in: 'list, any', out: 'list', c: 'lists' },
  { n: "Speaker's Decomposition", id: 'deconstruct', s: 'aaqwqaa', d: 'SOUTH_WEST', in: 'list', out: 'list, any', c: 'lists' },

  // --- entities -------------------------------------------------------------
  { n: 'Entity Purification', id: 'get_entity', s: 'qqqqqdaqa', d: 'SOUTH_EAST', in: 'vector', out: 'entity', c: 'entities' },
  { n: 'Entity Purification: Animal', id: 'get_entity/animal', s: 'qqqqqdaqaawa', d: 'SOUTH_EAST', in: 'vector', out: 'entity', c: 'entities' },
  { n: 'Entity Purification: Monster', id: 'get_entity/monster', s: 'qqqqqdaqaawq', d: 'SOUTH_EAST', in: 'vector', out: 'entity', c: 'entities' },
  { n: 'Entity Purification: Item', id: 'get_entity/item', s: 'qqqqqdaqaaww', d: 'SOUTH_EAST', in: 'vector', out: 'entity', c: 'entities' },
  { n: 'Entity Purification: Player', id: 'get_entity/player', s: 'qqqqqdaqaawe', d: 'SOUTH_EAST', in: 'vector', out: 'entity', c: 'entities' },
  { n: 'Entity Purification: Living', id: 'get_entity/living', s: 'qqqqqdaqaawd', d: 'SOUTH_EAST', in: 'vector', out: 'entity', c: 'entities' },
  { n: 'Zone Distillation: Any', id: 'zone_entity', s: 'qqqqqwded', d: 'SOUTH_EAST', in: 'vector, num', out: 'list', c: 'entities' },
  { n: 'Zone Distillation: Animal', id: 'zone_entity/animal', s: 'qqqqqwdeddwa', d: 'SOUTH_EAST', in: 'vector, num', out: 'list', c: 'entities' },
  { n: 'Zone Distillation: Non-Animal', id: 'zone_entity/not_animal', s: 'eeeeewaqaawa', d: 'NORTH_EAST', in: 'vector, num', out: 'list', c: 'entities' },
  { n: 'Zone Distillation: Monster', id: 'zone_entity/monster', s: 'qqqqqwdeddwq', d: 'SOUTH_EAST', in: 'vector, num', out: 'list', c: 'entities' },
  { n: 'Zone Distillation: Non-Monster', id: 'zone_entity/not_monster', s: 'eeeeewaqaawq', d: 'NORTH_EAST', in: 'vector, num', out: 'list', c: 'entities' },
  { n: 'Zone Distillation: Item', id: 'zone_entity/item', s: 'qqqqqwdeddww', d: 'SOUTH_EAST', in: 'vector, num', out: 'list', c: 'entities' },
  { n: 'Zone Distillation: Non-Item', id: 'zone_entity/not_item', s: 'eeeeewaqaaww', d: 'NORTH_EAST', in: 'vector, num', out: 'list', c: 'entities' },
  { n: 'Zone Distillation: Player', id: 'zone_entity/player', s: 'qqqqqwdeddwe', d: 'SOUTH_EAST', in: 'vector, num', out: 'list', c: 'entities' },
  { n: 'Zone Distillation: Non-Player', id: 'zone_entity/not_player', s: 'eeeeewaqaawe', d: 'NORTH_EAST', in: 'vector, num', out: 'list', c: 'entities' },
  { n: 'Zone Distillation: Living', id: 'zone_entity/living', s: 'qqqqqwdeddwd', d: 'SOUTH_EAST', in: 'vector, num', out: 'list', c: 'entities' },
  { n: 'Zone Distillation: Non-Living', id: 'zone_entity/not_living', s: 'eeeeewaqaawd', d: 'NORTH_EAST', in: 'vector, num', out: 'list', c: 'entities' },

  // --- read / write ---------------------------------------------------------
  { n: "Scribe's Reflection", id: 'read', s: 'aqqqqq', d: 'EAST', in: '', out: 'any', c: 'readwrite' },
  { n: "Scribe's Gambit", id: 'write', s: 'deeeee', d: 'EAST', in: 'any', out: '', c: 'readwrite' },
  { n: "Chronicler's Purification", id: 'read/entity', s: 'wawqwqwqwqwqw', d: 'EAST', in: 'entity', out: 'any', c: 'readwrite' },
  { n: "Chronicler's Gambit", id: 'write/entity', s: 'wdwewewewewew', d: 'EAST', in: 'entity, any', out: '', c: 'readwrite' },
  { n: "Auditor's Reflection", id: 'readable', s: 'aqqqqqe', d: 'EAST', in: '', out: 'bool', c: 'readwrite' },
  { n: "Auditor's Purification", id: 'readable/entity', s: 'wawqwqwqwqwqwew', d: 'EAST', in: 'entity', out: 'bool', c: 'readwrite' },
  { n: "Assessor's Reflection", id: 'writable', s: 'deeeeeq', d: 'EAST', in: '', out: 'bool', c: 'readwrite' },
  { n: "Assessor's Purification", id: 'writable/entity', s: 'wdwewewewewewqw', d: 'EAST', in: 'entity', out: 'bool', c: 'readwrite' },
  { n: "Muninn's Reflection", id: 'read/local', s: 'qeewdweddw', d: 'NORTH_EAST', in: '', out: 'any', c: 'readwrite' },
  { n: "Huginn's Gambit", id: 'write/local', s: 'eqqwawqaaw', d: 'NORTH_WEST', in: 'any', out: '', c: 'readwrite' },
  { n: "Akasha's Distillation", id: 'akashic/read', s: 'qqqwqqqqqaq', d: 'WEST', in: 'vector, pattern', out: 'any', c: 'readwrite' },
  { n: "Akasha's Gambit", id: 'akashic/write', s: 'eeeweeeeede', d: 'EAST', in: 'vector, pattern, any', out: '', c: 'readwrite' },

  // --- meta -----------------------------------------------------------------
  { n: "Hermes' Gambit", id: 'eval', s: 'deaqq', d: 'SOUTH_EAST', in: 'pattern|list', out: 'many', c: 'meta' },
  { n: "Iris' Gambit", id: 'eval/cc', s: 'qwaqde', d: 'NORTH_WEST', in: 'pattern|list', out: 'many', c: 'meta' },
  { n: "Thoth's Gambit", id: 'for_each', s: 'dadad', d: 'NORTH_EAST', in: 'list, list', out: 'list', c: 'meta' },
  { n: "Charon's Gambit", id: 'halt', s: 'aqdee', d: 'SOUTH_WEST', in: '', out: '', c: 'meta' },
  { n: "Thanatos' Reflection", id: 'thanatos', s: 'qqaed', d: 'SOUTH_EAST', in: '', out: 'number', c: 'meta' },

  // --- constants ------------------------------------------------------------
  { n: 'Nullary Reflection', id: 'const/null', s: 'd', d: 'EAST', in: '', out: 'null', c: 'consts' },
  { n: 'True Reflection', id: 'const/true', s: 'aqae', d: 'SOUTH_EAST', in: '', out: 'bool', c: 'consts' },
  { n: 'False Reflection', id: 'const/false', s: 'dedq', d: 'NORTH_EAST', in: '', out: 'bool', c: 'consts' },
  { n: 'Vector Reflection +X', id: 'const/vec/px', s: 'qqqqqea', d: 'NORTH_WEST', in: '', out: 'vector', c: 'consts' },
  { n: 'Vector Reflection +Y', id: 'const/vec/py', s: 'qqqqqew', d: 'NORTH_WEST', in: '', out: 'vector', c: 'consts' },
  { n: 'Vector Reflection +Z', id: 'const/vec/pz', s: 'qqqqqed', d: 'NORTH_WEST', in: '', out: 'vector', c: 'consts' },
  { n: 'Vector Reflection -X', id: 'const/vec/nx', s: 'eeeeeqa', d: 'SOUTH_WEST', in: '', out: 'vector', c: 'consts' },
  { n: 'Vector Reflection -Y', id: 'const/vec/ny', s: 'eeeeeqw', d: 'SOUTH_WEST', in: '', out: 'vector', c: 'consts' },
  { n: 'Vector Reflection -Z', id: 'const/vec/nz', s: 'eeeeeqd', d: 'SOUTH_WEST', in: '', out: 'vector', c: 'consts' },
  { n: 'Vector Reflection Zero', id: 'const/vec/0', s: 'qqqqq', d: 'NORTH_WEST', in: '', out: 'vector', c: 'consts' },
  { n: "Arc's Reflection", id: 'const/double/pi', s: 'qdwdq', d: 'NORTH_EAST', in: '', out: 'number', c: 'consts' },
  { n: "Circle's Reflection", id: 'const/double/tau', s: 'eawae', d: 'NORTH_WEST', in: '', out: 'number', c: 'consts' },
  { n: "Euler's Reflection", id: 'const/double/e', s: 'aaq', d: 'EAST', in: '', out: 'number', c: 'consts' },

  // --- spells ---------------------------------------------------------------
  { n: 'Reveal', id: 'print', s: 'de', d: 'NORTH_EAST', in: 'any', out: 'any', c: 'spells' },
  { n: 'Make Note', id: 'beep', s: 'adaa', d: 'WEST', in: 'vector, num, num', out: '', c: 'spells' },
  { n: 'Explosion', id: 'explode', s: 'aawaawaa', d: 'EAST', in: 'vector, num', out: '', c: 'spells' },
  { n: 'Fireball', id: 'explode/fire', s: 'ddwddwdd', d: 'EAST', in: 'vector, num', out: '', c: 'spells' },
  { n: 'Impulse', id: 'add_motion', s: 'awqqqwaqw', d: 'SOUTH_WEST', in: 'entity, vector', out: '', c: 'spells' },
  { n: 'Blink', id: 'blink', s: 'awqqqwaq', d: 'SOUTH_WEST', in: 'entity, num', out: '', c: 'spells' },
  { n: 'Break Block', id: 'break_block', s: 'qaqqqqq', d: 'EAST', in: 'vector', out: '', c: 'spells' },
  { n: 'Place Block', id: 'place_block', s: 'eeeeede', d: 'SOUTH_WEST', in: 'vector', out: '', c: 'spells' },
  { n: 'Internalize Pigment', id: 'colorize', s: 'awddwqawqwawq', d: 'EAST', in: '', out: '', c: 'spells' },
  { n: "Caster's Glamour", id: 'cycle_variant', s: 'dwaawedwewdwe', d: 'WEST', in: '', out: '', c: 'spells' },
  { n: 'Create Water', id: 'create_water', s: 'aqawqadaq', d: 'SOUTH_EAST', in: 'vector', out: '', c: 'spells' },
  { n: 'Destroy Liquid', id: 'destroy_water', s: 'dedwedade', d: 'SOUTH_WEST', in: 'vector', out: '', c: 'spells' },
  { n: 'Ignite', id: 'ignite', s: 'aaqawawa', d: 'SOUTH_EAST', in: 'vector|entity', out: '', c: 'spells' },
  { n: 'Extinguish Area', id: 'extinguish', s: 'ddedwdwd', d: 'SOUTH_WEST', in: 'vector', out: '', c: 'spells' },
  { n: 'Conjure Block', id: 'conjure_block', s: 'qqa', d: 'NORTH_EAST', in: 'vector', out: '', c: 'spells' },
  { n: 'Conjure Light', id: 'conjure_light', s: 'qqd', d: 'NORTH_EAST', in: 'vector', out: '', c: 'spells' },
  { n: 'Overgrow', id: 'bonemeal', s: 'wqaqwawqaqw', d: 'NORTH_EAST', in: 'vector', out: '', c: 'spells' },
  { n: 'Edify Sapling', id: 'edify', s: 'wqaqwd', d: 'NORTH_EAST', in: 'vector', out: '', c: 'spells' },
  { n: 'Recharge Item', id: 'recharge', s: 'qqqqqwaeaeaeaeaea', d: 'NORTH_WEST', in: 'entity', out: '', c: 'spells' },
  { n: 'Erase Item', id: 'erase', s: 'qdqawwaww', d: 'EAST', in: '', out: '', c: 'spells' },
  { n: 'Craft Cypher', id: 'craft/cypher', s: 'waqqqqq', d: 'EAST', in: 'entity, list', out: '', c: 'spells' },
  { n: 'Craft Trinket', id: 'craft/trinket', s: 'wwaqqqqqeaqeaeqqqeaeq', d: 'EAST', in: 'entity, list', out: '', c: 'spells' },
  { n: 'Craft Artifact', id: 'craft/artifact', s: 'wwaqqqqqeawqwqwqwqwqwwqqeadaeqqeqqeadaeqq', d: 'EAST', in: 'entity, list', out: '', c: 'spells' },
  { n: 'Craft Phial', id: 'craft/battery', s: 'aqqqaqwwaqqqqqeqaqqqawwqwqwqwqwqw', d: 'SOUTH_WEST', in: 'entity', out: '', c: 'spells' },
  { n: 'Summon Sentinel', id: 'sentinel/create', s: 'waeawae', d: 'EAST', in: 'vector', out: '', c: 'spells' },
  { n: 'Banish Sentinel', id: 'sentinel/destroy', s: 'qdwdqdw', d: 'NORTH_EAST', in: '', out: '', c: 'spells' },
  { n: 'Locate Sentinel', id: 'sentinel/get_pos', s: 'waeawaede', d: 'EAST', in: '', out: 'vector', c: 'spells' },
  { n: 'Wayfind Sentinel', id: 'sentinel/wayfind', s: 'waeawaedwa', d: 'EAST', in: 'vector', out: 'vector', c: 'spells' },
  { n: "Anchorite's Flight", id: 'flight/range', s: 'awawaawq', d: 'SOUTH_WEST', in: 'entity, num', out: '', c: 'spells' },
  { n: "Wayfarer's Flight", id: 'flight/time', s: 'dwdwdewq', d: 'NORTH_EAST', in: 'entity, num', out: '', c: 'spells' },
  { n: "Aviator's Purification", id: 'flight/can_fly', s: 'dwdwdeweaqa', d: 'NORTH_EAST', in: 'entity', out: 'bool', c: 'spells' },
  { n: "Gulliver's Purification", id: 'interop/pehkui/get', s: 'aawawwawwa', d: 'NORTH_WEST', in: 'entity', out: 'number', c: 'spells' },
  { n: 'Alter Scale', id: 'interop/pehkui/set', s: 'ddwdwwdwwd', d: 'NORTH_EAST', in: 'entity, num', out: '', c: 'spells' },

  // --- potions --------------------------------------------------------------
  { n: "White Sun's Nadir", id: 'potion/weakness', s: 'qqqqqaqwawaw', d: 'NORTH_WEST', in: 'entity, num, num', out: '', c: 'potions' },
  { n: "Blue Sun's Nadir", id: 'potion/levitation', s: 'qqqqqawwawawd', d: 'WEST', in: 'entity, num', out: '', c: 'potions' },
  { n: "Black Sun's Nadir", id: 'potion/wither', s: 'qqqqqaewawawe', d: 'SOUTH_WEST', in: 'entity, num, num', out: '', c: 'potions' },
  { n: "Red Sun's Nadir", id: 'potion/poison', s: 'qqqqqadwawaww', d: 'SOUTH_EAST', in: 'entity, num, num', out: '', c: 'potions' },
  { n: "Green Sun's Nadir", id: 'potion/slowness', s: 'qqqqqadwawaw', d: 'SOUTH_EAST', in: 'entity, num, num', out: '', c: 'potions' },

  // --- great spells ---------------------------------------------------------
  { n: "White Sun's Zenith", id: 'potion/regeneration', s: 'qqqqaawawaedd', d: 'NORTH_WEST', in: 'entity, num, num', out: '', c: 'great', great: true },
  { n: "Blue Sun's Zenith", id: 'potion/night_vision', s: 'qqqaawawaeqdd', d: 'WEST', in: 'entity, num', out: '', c: 'great', great: true },
  { n: "Black Sun's Zenith", id: 'potion/absorption', s: 'qqaawawaeqqdd', d: 'SOUTH_WEST', in: 'entity, num, num', out: '', c: 'great', great: true },
  { n: "Red Sun's Zenith", id: 'potion/haste', s: 'qaawawaeqqqdd', d: 'SOUTH_EAST', in: 'entity, num, num', out: '', c: 'great', great: true },
  { n: "Green Sun's Zenith", id: 'potion/strength', s: 'aawawaeqqqqdd', d: 'EAST', in: 'entity, num, num', out: '', c: 'great', great: true },
  { n: 'Altiora', id: 'flight', s: 'eawwaeawawaa', d: 'NORTH_WEST', in: 'entity', out: '', c: 'great', great: true },
  { n: 'Summon Greater Sentinel', id: 'sentinel/create/great', s: 'waeawaeqqqwqwqqwq', d: 'EAST', in: 'vector', out: '', c: 'great', great: true },
  { n: 'Summon Lightning', id: 'lightning', s: 'waadwawdaaweewq', d: 'EAST', in: 'vector', out: '', c: 'great', great: true },
  { n: 'Summon Rain', id: 'summon_rain', s: 'wwweeewwweewdawdwad', d: 'WEST', in: '', out: '', c: 'great', great: true },
  { n: 'Dispel Rain', id: 'dispel_rain', s: 'eeewwweeewwaqqddqdqd', d: 'EAST', in: '', out: '', c: 'great', great: true },
  { n: 'Create Lava', id: 'create_lava', s: 'eaqawqadaqd', d: 'EAST', in: 'vector', out: '', c: 'great', great: true },
  { n: 'Greater Teleport', id: 'teleport/great', s: 'wwwqqqwwwqqeqqwwwqqwqqdqqqqqdqq', d: 'EAST', in: 'entity, vector', out: '', c: 'great', great: true },
  { n: 'Flay Mind', id: 'brainsweep', s: 'qeqwqwqwqwqeqaeqeaqeqaeqaqded', d: 'NORTH_EAST', in: 'entity, vector', out: '', c: 'great', great: true },

  // --- Hexal 0.3.1 ----------------------------------------------------------
  // Signatures from FallingColors/Hexal @ 0.3.1, HexalActions.kt
  { n: 'Particles', id: 'particles', s: 'eqqqqa', d: 'NORTH_EAST', in: 'vector | list', out: '', c: 'hexal', mod: 'hexal' },
  { n: 'Running Sum Purification', id: 'running/sum', s: 'aea', d: 'WEST', in: 'list', out: 'list', c: 'hexal', mod: 'hexal' },

  // --- HexWorld additions ---------------------------------------------------
  // Not from any mod — invented for this sandbox.
  { n: 'Cursor Reflection', id: 'cursor', s: 'qwq', d: 'EAST', in: '', out: 'vector', c: 'hexworld', mod: 'hexworld' },
];

// Special forms — raw VM hooks, not registry actions.
const SPECIAL_FORMS = {
  qqq: { n: 'Introspection', id: 'open_paren', d: 'WEST' },
  eee: { n: 'Retrospection', id: 'close_paren', d: 'EAST' },
  qqqaw: { n: 'Consideration', id: 'escape', d: 'WEST' },
  eeedw: { n: 'Evanition', id: 'undo', d: 'EAST' },
};

const BY_SIG = new Map();
const BY_ID = new Map();
const BY_NAME = new Map();
for (const p of PATTERNS) {
  BY_SIG.set(p.s, p);
  BY_ID.set(p.id, p);
  BY_NAME.set(p.n.toLowerCase(), p);
}

// --- special handler: numerical reflection ----------------------------------
// Prefix aqaa (positive) / dedd (negative), then fold left-to-right with no
// precedence: w+1, q+5, e+10, a*2, d/2, s no-op.
function matchNumber(sig) {
  let negative;
  if (sig.startsWith('aqaa')) negative = false;
  else if (sig.startsWith('dedd')) negative = true;
  else return null;
  let acc = 0;
  for (const ch of sig.slice(4)) {
    if (ch === 'w') acc += 1;
    else if (ch === 'q') acc += 5;
    else if (ch === 'e') acc += 10;
    else if (ch === 'a') acc *= 2;
    else if (ch === 'd') acc /= 2;
    else if (ch === 's') { /* ok funny man */ }
    else return null;
  }
  return negative ? -acc : acc;
}

// Cheap generator: build the shortest signature we can for a value using a
// greedy walk over the +10/+5/+1 and *2 operations.
function numberToSig(value) {
  const neg = value < 0;
  let v = Math.abs(value);
  if (!isFinite(v)) return null;
  const prefix = neg ? 'dedd' : 'aqaa';

  // Exact integers: build by doubling and adding, chosen to keep the string short.
  const build = (target) => {
    if (target === 0) return '';
    if (!Number.isInteger(target)) return null;
    let best = null;
    const rec = (remaining, depth) => {
      if (depth > 12) return null;
      if (remaining === 0) return '';
      let out = '';
      let r = remaining;
      // prefer halving path when even and large
      if (r % 2 === 0 && r > 20) {
        const sub = rec(r / 2, depth + 1);
        if (sub !== null) return sub + 'a';
      }
      while (r >= 10) { out += 'e'; r -= 10; }
      while (r >= 5) { out += 'q'; r -= 5; }
      while (r >= 1) { out += 'w'; r -= 1; }
      return out;
    };
    best = rec(target, 0);
    return best;
  };

  if (Number.isInteger(v)) {
    const body = build(v);
    if (body !== null) return { signature: prefix + body, startDir: neg ? 'NORTH_EAST' : 'SOUTH_EAST' };
  }
  // Halves: build 2v then halve.
  if (Number.isInteger(v * 2)) {
    const body = build(v * 2);
    if (body !== null) return { signature: prefix + body + 'd', startDir: neg ? 'NORTH_EAST' : 'SOUTH_EAST' };
  }
  return null;
}

// --- special handler: bookkeeper's gambit -----------------------------------
// Works on absolute segment directions, not angle letters. Flat run = keep ('-'),
// a right-then-left dip = drop ('v'). Note '-' is KEEP and 'v' is DROP.
function matchMask(sig, startDir) {
  const dirs = Hex.patternDirections(sig, startDir);
  let flatDir = startDir;
  if (sig[0] === 'a') flatDir = Hex.rotate(dirs[0], Hex.LEFT);
  const mask = [];
  let i = 0;
  while (i < dirs.length) {
    const angle = Hex.angleBetween(dirs[i], flatDir);
    if (angle === Hex.FORWARD) { mask.push(true); i += 1; continue; }
    if (i >= dirs.length - 1) return null;
    const angle2 = Hex.angleBetween(dirs[i + 1], flatDir);
    if (angle === Hex.RIGHT && angle2 === Hex.LEFT) { mask.push(false); i += 2; continue; }
    return null;
  }
  return mask;
}

function maskToString(mask) {
  return mask.map((k) => (k ? '-' : 'v')).join('');
}

// Exact inverse of matchMask: walk a flat baseline, emitting one segment along
// it per keep and a right-then-left dip per drop, then read off the turns.
// Taking flat = EAST makes the start direction fall out on its own — EAST when
// the mask opens with a keep, SOUTH_EAST when it opens with a drop.
function maskToPattern(code) {
  const mask = [];
  for (const ch of code) {
    if (ch === '-') mask.push(true);
    else if (ch === 'v') mask.push(false);
    else return null;
  }
  if (!mask.length) return null;

  const flat = Hex.dirIndex('EAST');
  const dirs = [];
  for (const keep of mask) {
    if (keep) dirs.push(flat);
    else { dirs.push(Hex.rotate(flat, Hex.RIGHT)); dirs.push(Hex.rotate(flat, Hex.LEFT)); }
  }

  let sig = '';
  for (let i = 1; i < dirs.length; i++) {
    sig += Hex.CHAR_FROM_ANGLE[Hex.angleBetween(dirs[i], dirs[i - 1])];
  }
  return { signature: sig, startDir: Hex.DIR_NAMES[dirs[0]] };
}

// --- the matcher ------------------------------------------------------------
// Order is deliberate in HexMod: normal actions before special handlers, so a
// registered pattern can never be shadowed by a number literal.
function matchPattern(signature, startDir) {
  const sf = SPECIAL_FORMS[signature];
  if (sf) return { kind: 'special', id: sf.id, name: sf.n, signature, startDir };

  const p = BY_SIG.get(signature);
  if (p) return { kind: 'action', id: p.id, name: p.n, def: p, signature, startDir };

  const num = matchNumber(signature);
  if (num !== null) {
    return { kind: 'number', id: 'number', name: 'Numerical Reflection: ' + fmtNum(num), value: num, signature, startDir };
  }

  const mask = matchMask(signature, typeof startDir === 'number' ? startDir : Hex.dirIndex(startDir));
  if (mask) {
    return { kind: 'mask', id: 'mask', name: "Bookkeeper's Gambit: " + maskToString(mask), mask, signature, startDir };
  }

  return { kind: 'unknown', id: 'unknown', name: 'Unknown Pattern', signature, startDir };
}

function fmtNum(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10000) / 10000);
}

// Resolve free text from the "Add a pattern" box: display name, internal name,
// raw angle signature, bare number, or bookkeeper code.
function resolveText(text) {
  const t = text.trim();
  if (!t) return null;

  const byName = BY_NAME.get(t.toLowerCase());
  if (byName) return { signature: byName.s, startDir: Hex.dirIndex(byName.d) };

  for (const [sig, sf] of Object.entries(SPECIAL_FORMS)) {
    if (sf.n.toLowerCase() === t.toLowerCase() || sf.id === t) {
      return { signature: sig, startDir: Hex.dirIndex(sf.d) };
    }
  }
  if (t === '{') return { signature: 'qqq', startDir: Hex.dirIndex('WEST') };
  if (t === '}') return { signature: 'eee', startDir: Hex.dirIndex('EAST') };

  // Convenient shorthands for the constants.
  const alias = {
    true: 'const/true', false: 'const/false', null: 'const/null',
    pi: 'const/double/pi', tau: 'const/double/tau', e: 'const/double/e',
    swap: 'swap', dup: 'duplicate', over: 'over', tuck: 'tuck',
  }[t.toLowerCase()];
  if (alias && BY_ID.has(alias)) {
    const p = BY_ID.get(alias);
    return { signature: p.s, startDir: Hex.dirIndex(p.d) };
  }

  const byId = BY_ID.get(t) || BY_ID.get(t.replace(/^(hexcasting|hexal|hexworld):/, ''));
  if (byId) return { signature: byId.s, startDir: Hex.dirIndex(byId.d) };

  // "Numerical Reflection: 5" / "Bookkeeper's Gambit: v-"
  const colon = t.indexOf(':');
  if (colon > 0) {
    const head = t.slice(0, colon).trim().toLowerCase();
    const tail = t.slice(colon + 1).trim();
    if (head === 'numerical reflection') {
      const v = parseFloat(tail);
      if (!isNaN(v)) { const r = numberToSig(v); if (r) return { signature: r.signature, startDir: Hex.dirIndex(r.startDir) }; }
    }
    if (head === "bookkeeper's gambit") {
      const r = maskToPattern(tail);
      if (r) return { signature: r.signature, startDir: Hex.dirIndex(r.startDir) };
    }
  }

  if (/^-?\d+(\.\d+)?$/.test(t)) {
    const r = numberToSig(parseFloat(t));
    if (r) return { signature: r.signature, startDir: Hex.dirIndex(r.startDir) };
  }
  if (/^[-v]+$/.test(t)) {
    const r = maskToPattern(t);
    if (r) return { signature: r.signature, startDir: Hex.dirIndex(r.startDir) };
  }
  if (/^[qawed]+$/.test(t)) {
    return { signature: t, startDir: Hex.dirIndex('EAST') };
  }
  return null;
}

function searchPatterns(query) {
  const q = query.trim().toLowerCase();
  const results = [];
  const push = (name, sig, dir, sub) => results.push({ name, signature: sig, startDir: Hex.dirIndex(dir), sub });
  if (!q) {
    for (const p of PATTERNS) push(p.n, p.s, p.d, p.id);
    for (const [sig, sf] of Object.entries(SPECIAL_FORMS)) push(sf.n, sig, sf.d, sf.id);
    return results;
  }
  for (const p of PATTERNS) {
    if (p.n.toLowerCase().includes(q) || p.id.includes(q)) push(p.n, p.s, p.d, p.id);
  }
  for (const [sig, sf] of Object.entries(SPECIAL_FORMS)) {
    if (sf.n.toLowerCase().includes(q) || sf.id.includes(q)) push(sf.n, sig, sf.d, sf.id);
  }
  if (/^-?\d+(\.\d+)?$/.test(q)) {
    const r = numberToSig(parseFloat(q));
    if (r) push('Numerical Reflection: ' + q, r.signature, r.startDir, 'number');
  }
  if (/^[-v]+$/.test(q)) {
    const r = maskToPattern(q);
    if (r) push("Bookkeeper's Gambit: " + q, r.signature, r.startDir, 'mask');
  }
  return results;
}

window.Registry = {
  PATTERNS, SPECIAL_FORMS, BY_SIG, BY_ID, BY_NAME,
  matchPattern, matchNumber, matchMask, maskToString, maskToPattern,
  numberToSig, resolveText, searchPatterns, fmtNum,
};
