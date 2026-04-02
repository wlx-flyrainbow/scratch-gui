import PropTypes from 'prop-types';
import React from 'react';

class ZhimengLoginForm extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            username: '',
            password: '',
            submitting: false,
            error: null
        };
        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    handleChange (event) {
        const {name, value} = event.target;
        this.setState({[name]: value});
    }

    async handleSubmit (event) {
        event.preventDefault();
        const {username, password} = this.state;
        if (!username || !password) {
            this.setState({error: '请输入账号与密码'});
            return;
        }
        this.setState({submitting: true, error: null});
        try {
            await this.props.onLogin({username, password});
            this.props.onClose();
        } catch (err) {
            this.setState({error: err.message || '登录失败，请稍后重试'});
        } finally {
            this.setState({submitting: false});
        }
    }

    render () {
        return (
            <form onSubmit={this.handleSubmit}>
                <div>
                    <input
                        name="username"
                        placeholder="账号"
                        type="text"
                        value={this.state.username}
                        onChange={this.handleChange}
                    />
                </div>
                <div style={{marginTop: '8px'}}>
                    <input
                        name="password"
                        placeholder="密码"
                        type="password"
                        value={this.state.password}
                        onChange={this.handleChange}
                    />
                </div>
                {this.state.error ? (
                    <div style={{marginTop: '8px', color: '#d32f2f'}}>
                        {this.state.error}
                    </div>
                ) : null}
                <button
                    disabled={this.state.submitting}
                    style={{marginTop: '10px'}}
                    type="submit"
                >
                    {this.state.submitting ? '登录中...' : '登录'}
                </button>
            </form>
        );
    }
}

ZhimengLoginForm.propTypes = {
    onClose: PropTypes.func.isRequired,
    onLogin: PropTypes.func.isRequired
};

export default ZhimengLoginForm;
