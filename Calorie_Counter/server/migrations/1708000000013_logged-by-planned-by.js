exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn('meals', {
    logged_by: { type: 'integer', references: 'users(id)', onDelete: 'SET NULL' },
  });
  pgm.addColumn('planned_meals', {
    planned_by: { type: 'integer', references: 'users(id)', onDelete: 'SET NULL' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('meals', 'logged_by');
  pgm.dropColumn('planned_meals', 'planned_by');
};
