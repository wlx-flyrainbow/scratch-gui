import PropTypes from 'prop-types';
import React from 'react';

import styles from './zhimeng-login-form.css';

class ZhimengLoginForm extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            mode: 'login',
            username: '',
            password: '',
            nickname: '',
            submitting: false,
            error: null
        };
        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleSwitchToLogin = this.handleSwitchToLogin.bind(this);
        this.handleSwitchToRegister = this.handleSwitchToRegister.bind(this);
    }

    handleChange (event) {
        const {name, value} = event.target;
        this.setState({[name]: value});
    }

    async handleSubmit (event) {
        event.preventDefault();
        const {mode, username, password, nickname} = this.state;
        if (!username || !password) {
            this.setState({error: '请输入账号与密码'});
            return;
        }
        this.setState({submitting: true, error: null});
        try {
            if (mode === 'register') {
                await this.props.onRegister({username, password, nickname});
            } else {
                await this.props.onLogin({username, password});
            }
            this.props.onClose();
        } catch (err) {
            this.setState({error: err.message || (mode === 'register' ?
                '注册失败，请稍后重试' :
                '登录失败，请稍后重试')});
        } finally {
            this.setState({submitting: false});
        }
    }

    handleSwitchToLogin () {
        this.setState({mode: 'login', error: null});
    }

    handleSwitchToRegister () {
        this.setState({mode: 'register', error: null});
    }

    render () {
        const isRegister = this.state.mode === 'register';
        const isLogin = this.state.mode === 'login';
        return (
            <form
                className={styles.authForm}
                onSubmit={this.handleSubmit}
            >
                <div className={styles.authHero}>
                    <div className={styles.authBadge}>{'新祥编程账号'}</div>
                    <h2>{isRegister ? '创建新祥编程账号' : '欢迎回来'}</h2>
                    <p>
                        {isRegister ?
                            '注册后即可查看订阅状态，完成开通后进入完整编程编辑器。' :
                            '登录后可继续完成订阅开通，并在授权生效后进入完整编程编辑器。'}
                    </p>
                </div>
                <div
                    aria-label="账号操作"
                    className={styles.authTabs}
                    role="tablist"
                >
                    <button
                        aria-selected={isLogin}
                        className={isLogin ? styles.isSelected : ''}
                        role="tab"
                        type="button"
                        onClick={this.handleSwitchToLogin}
                    >
                        {'登录'}
                    </button>
                    <button
                        aria-selected={isRegister}
                        className={isRegister ? styles.isSelected : ''}
                        role="tab"
                        type="button"
                        onClick={this.handleSwitchToRegister}
                    >
                        {'注册'}
                    </button>
                </div>
                <label className={styles.authField}>
                    <span>{'账号'}</span>
                    <input
                        autoComplete="username"
                        name="username"
                        placeholder="请输入 3-32 位字母、数字或下划线"
                        type="text"
                        value={this.state.username}
                        onChange={this.handleChange}
                    />
                </label>
                {isRegister ? (
                    <label className={styles.authField}>
                        <span>{'昵称'}</span>
                        <input
                            autoComplete="nickname"
                            name="nickname"
                            placeholder="昵称（可选）"
                            type="text"
                            value={this.state.nickname}
                            onChange={this.handleChange}
                        />
                    </label>
                ) : null}
                <label className={styles.authField}>
                    <span>{'密码'}</span>
                    <input
                        autoComplete={isRegister ? 'new-password' : 'current-password'}
                        name="password"
                        placeholder={isRegister ? '至少 6 位密码' : '请输入密码'}
                        type="password"
                        value={this.state.password}
                        onChange={this.handleChange}
                    />
                </label>
                {this.state.error ? (
                    <div
                        className={styles.authError}
                        role="alert"
                    >
                        {this.state.error}
                    </div>
                ) : null}
                <button
                    className={styles.authSubmit}
                    disabled={this.state.submitting}
                    type="submit"
                >
                    {this.state.submitting ?
                        (isRegister ? '注册中...' : '登录中...') :
                        (isRegister ? '注册并登录' : '登录')}
                </button>
                <div className={styles.authSwitchHint}>
                    <span>{isRegister ? '已有账号？' : '还没有账号？'}</span>
                    <button
                        type="button"
                        onClick={isRegister ? this.handleSwitchToLogin : this.handleSwitchToRegister}
                    >
                        {isRegister ? '去登录' : '立即注册'}
                    </button>
                </div>
            </form>
        );
    }
}

ZhimengLoginForm.propTypes = {
    onClose: PropTypes.func.isRequired,
    onLogin: PropTypes.func.isRequired,
    onRegister: PropTypes.func.isRequired
};

export default ZhimengLoginForm;
