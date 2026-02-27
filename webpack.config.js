module.exports = {
    externals: {
        react: "React",
        "react-dom": "ReactDOM",
        "@blueprintjs/core": ["Blueprint", "Core"],
    },
    externalsType: "window",
    entry: './src/index.js',
    output: {
        filename: 'extension.js',
        path: __dirname,
        library: {
            type: "module",
        }
    },
    experiments: {
        outputModule: true,
    },
    mode: "production",
    module: {
        rules: [{
            test: /\.jsx?$/,
            exclude: /node_modules/,
            use: {
                loader: 'babel-loader',
                options: {
                    presets: [
                        '@babel/preset-env',
                        ['@babel/preset-react', { runtime: 'classic' }]
                    ]
                }
            }
        }]
    },
    resolve: {
        extensions: ['.js', '.jsx'],
    },
};
