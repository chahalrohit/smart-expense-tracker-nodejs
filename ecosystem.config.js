module.exports = {
  apps: [
    {
      name: "smart-expense-tracker-nodejs",
      script: "./index.js",
      exec_mode: "fork",
      interpreter: "node",
      interpreter_args: "-r @babel/register",
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
